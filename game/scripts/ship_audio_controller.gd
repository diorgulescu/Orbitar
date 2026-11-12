# SPDX-License-Identifier: GPL-3.0-or-later
class_name ShipAudioController
extends Node3D

## Sistemul Audio Reactiv & Acustica de Cabină (`ShipAudioController`) pentru Orbitar 3D:
## - Configurează și comută automat între sub-bus-urile `ShipExterior` și `ShipCockpit`
##   (cu `AudioEffectLowPassFilter` și `AudioEffectReverb` pentru senzația de capsulă presurizată).
## - Sintetizează procedural tot sunetul navei (prin `AudioStreamGenerator` în timp real +
##   bucle PCM 16-bit generate în memorie), fără dependențe externe lipsă:
##   1. Pornire / Oprire Motoare (tasta `E`): secvență Power-Up (frecvență ascendentă + progres
##      pentru luminile din bordul 3D) și Power-Down (plutire silențioasă în fața planetelor).
##   2. Zgomotul de fond al reactorului (Idle Hum): bâzâit grav, cald și liniștitor.
##   3. Propulsie dinamică (Main Thrusters): `pitch_scale` (0.8 -> 1.8) și `volume_db` în timp real.
##   4. Jeturi RCS la rotație: pufăituri scurte de gaz comprimat la Pitch / Yaw / Roll.
##   5. Sunet de Mini-Warp: încărcare de 1.0 secundă urmată de tranziția superluminică profundă.

signal engine_power_toggled(online: bool)
signal engine_power_progress_changed(progress: float)
signal warp_charge_started()
signal warp_transition_boom_triggered()
signal hyper_drop_bass_triggered()
signal radio_comms_squelch_played()

const BUS_EXTERIOR: StringName = &"ShipExterior"
const BUS_COCKPIT: StringName = &"ShipCockpit"
const SAMPLE_RATE: int = 22050
const WARP_CHARGE_DURATION_SEC: float = 1.0
const POWER_SEQUENCE_DURATION_SEC: float = 0.85

@export var engines_online: bool = true
var engine_power_progress: float = 1.0 # 0.0 (oprit) .. 1.0 (pornit complet)
var active_bus_name: StringName = BUS_EXTERIOR
var is_cockpit_acoustics: bool = false

# Telemetrie audio expusă pentru inspecție și teste
var current_throttle: float = 0.0
var current_thruster_pitch_scale: float = 0.8
var current_thruster_volume_db: float = -24.0
var rcs_active: bool = false
var warp_charging: bool = false
var warp_charge_progress: float = 0.0
var warp_superluminal_active: bool = false
var radio_squelch_count: int = 0
var hyper_drop_bass_count: int = 0

# Playere audio
var idle_hum_player: AudioStreamPlayer = null
var main_thrusters_player: AudioStreamPlayer = null
var rcs_jets_player: AudioStreamPlayer = null
var warp_drive_player: AudioStreamPlayer = null
var hyper_drop_player: AudioStreamPlayer = null
var radio_comms_player: AudioStreamPlayer = null
var realtime_synth_player: AudioStreamPlayer = null
var _synth_playback: AudioStreamGeneratorPlayback = null

# Faze interne pentru sintetizatorul procedural AudioStreamGenerator
var _synth_phase_a: float = 0.0
var _synth_phase_b: float = 0.0
var _power_sweep_timer: float = 0.0
var _power_sweep_direction: int = 0 # 1 = Power-Up, -1 = Power-Down, 0 = stabil
var _warp_boom_timer: float = 0.0
var _hyper_drop_bass_timer: float = 0.0
var _rcs_cooldown: float = 0.0
var _rng := RandomNumberGenerator.new()

var _is_headless: bool = false

func _ready() -> void:
	_rng.seed = 19690720
	_is_headless = (DisplayServer.get_name() == "headless")
	_ensure_audio_buses()
	_create_procedural_audio_players()
	set_acoustic_environment(false)

func _exit_tree() -> void:
	_synth_playback = null
	for player in [
		idle_hum_player,
		main_thrusters_player,
		rcs_jets_player,
		warp_drive_player,
		hyper_drop_player,
		radio_comms_player,
		realtime_synth_player,
	]:
		if player != null:
			player.stop()
			player.stream = null

## Garantează existența sub-bus-urilor `ShipExterior` și `ShipCockpit`
## (cu `AudioEffectLowPassFilter` și `AudioEffectReverb`) în `AudioServer`.
func _ensure_audio_buses() -> void:
	var ext_idx: int = AudioServer.get_bus_index(BUS_EXTERIOR)
	if ext_idx == -1:
		ext_idx = AudioServer.bus_count
		AudioServer.add_bus(ext_idx)
		AudioServer.set_bus_name(ext_idx, String(BUS_EXTERIOR))
		AudioServer.set_bus_send(ext_idx, "Master")

	var cock_idx: int = AudioServer.get_bus_index(BUS_COCKPIT)
	if cock_idx == -1:
		cock_idx = AudioServer.bus_count
		AudioServer.add_bus(cock_idx)
		AudioServer.set_bus_name(cock_idx, String(BUS_COCKPIT))
		AudioServer.set_bus_send(cock_idx, "Master")

	# Verificăm ca ShipCockpit să aibă AudioEffectLowPassFilter și AudioEffectReverb
	var has_lpf: bool = false
	var has_reverb: bool = false
	for i in range(AudioServer.get_bus_effect_count(cock_idx)):
		var fx: AudioEffect = AudioServer.get_bus_effect(cock_idx, i)
		if fx is AudioEffectLowPassFilter:
			has_lpf = true
		elif fx is AudioEffectReverb:
			has_reverb = true

	if not has_lpf:
		var lpf := AudioEffectLowPassFilter.new()
		lpf.cutoff_hz = 2850.0
		lpf.resonance = 0.42
		AudioServer.add_bus_effect(cock_idx, lpf)

	if not has_reverb:
		var rev := AudioEffectReverb.new()
		rev.room_size = 0.18
		rev.damping = 0.72
		rev.spread = 0.55
		rev.dry = 0.88
		rev.wet = 0.14
		AudioServer.add_bus_effect(cock_idx, rev)

func _create_procedural_audio_players() -> void:
	# 1. Idle Hum Player (bâzâit grav, cald și liniștitor al reactorului)
	idle_hum_player = AudioStreamPlayer.new()
	idle_hum_player.name = "ReactorIdleHumPlayer"
	idle_hum_player.stream = _generate_reactor_idle_hum_wav(2.0)
	idle_hum_player.volume_db = -10.5
	idle_hum_player.pitch_scale = 1.0
	idle_hum_player.bus = active_bus_name
	add_child(idle_hum_player)
	if not _is_headless:
		idle_hum_player.play()

	# 2. Main Thrusters Player (propulsie dinamică cu pitch_scale 0.8 -> 1.8)
	main_thrusters_player = AudioStreamPlayer.new()
	main_thrusters_player.name = "MainThrustersPlayer"
	main_thrusters_player.stream = _generate_main_thruster_loop_wav(1.5)
	main_thrusters_player.volume_db = -28.0
	main_thrusters_player.pitch_scale = 0.8
	main_thrusters_player.bus = active_bus_name
	add_child(main_thrusters_player)
	if not _is_headless:
		main_thrusters_player.play()

	# 3. RCS Jets Player (sunete scurte de gaz comprimat la Pitch/Yaw/Roll)
	rcs_jets_player = AudioStreamPlayer.new()
	rcs_jets_player.name = "RcsJetsPlayer"
	rcs_jets_player.stream = _generate_rcs_burst_wav(0.18)
	rcs_jets_player.volume_db = -12.0
	rcs_jets_player.bus = active_bus_name
	add_child(rcs_jets_player)

	# 4. Mini-Warp Drive Player (încărcare 1s + tranziție superluminică)
	warp_drive_player = AudioStreamPlayer.new()
	warp_drive_player.name = "MiniWarpDrivePlayer"
	warp_drive_player.stream = _generate_warp_charge_and_boom_wav(2.2)
	warp_drive_player.volume_db = -8.0
	warp_drive_player.bus = active_bus_name
	add_child(warp_drive_player)

	# 5. Radio Comms Squelch Player (efect sonor discret de stație radio la replicile pilotului)
	radio_comms_player = AudioStreamPlayer.new()
	radio_comms_player.name = "RadioCommsSquelchPlayer"
	radio_comms_player.stream = _generate_radio_squelch_wav(0.14)
	radio_comms_player.volume_db = -11.5
	radio_comms_player.bus = active_bus_name
	add_child(radio_comms_player)

	# 5b. Hyper-Drop Deep Bass Player (sunet profund de bas de 1.5s la frânarea gravitațională automată)
	hyper_drop_player = AudioStreamPlayer.new()
	hyper_drop_player.name = "HyperDropBassPlayer"
	hyper_drop_player.stream = _generate_hyper_drop_bass_wav(1.5)
	hyper_drop_player.volume_db = -4.5
	hyper_drop_player.bus = active_bus_name
	add_child(hyper_drop_player)

	# 6. Sintetizator în timp real (`AudioStreamGenerator`) pentru Power-Up / Power-Down & armonici
	realtime_synth_player = AudioStreamPlayer.new()
	realtime_synth_player.name = "RealtimeProceduralSynth"
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = float(SAMPLE_RATE)
	gen.buffer_length = 0.12
	realtime_synth_player.stream = gen
	realtime_synth_player.volume_db = -9.0
	realtime_synth_player.bus = active_bus_name
	add_child(realtime_synth_player)
	if not _is_headless:
		realtime_synth_player.play()
		_synth_playback = realtime_synth_player.get_stream_playback() as AudioStreamGeneratorPlayback

## Comută automat mixajul acustic între exteriorul navei (`ShipExterior`) și
## interiorul presurizat al cabinei (`ShipCockpit` cu LowPassFilter + Reverb).
func set_acoustic_environment(in_cockpit: bool) -> void:
	is_cockpit_acoustics = in_cockpit
	active_bus_name = BUS_COCKPIT if in_cockpit else BUS_EXTERIOR

	for player in [
		idle_hum_player,
		main_thrusters_player,
		rcs_jets_player,
		warp_drive_player,
		hyper_drop_player,
		radio_comms_player,
		realtime_synth_player,
	]:
		if player != null:
			player.bus = active_bus_name

	var ext_idx: int = AudioServer.get_bus_index(BUS_EXTERIOR)
	var cock_idx: int = AudioServer.get_bus_index(BUS_COCKPIT)
	if ext_idx != -1:
		AudioServer.set_bus_mute(ext_idx, in_cockpit)
	if cock_idx != -1:
		AudioServer.set_bus_mute(cock_idx, not in_cockpit)

## Pornește sau oprește motoarele navei (tasta `E`).
## Declanșează secvența de Power-Up (frecvență ascendentă + aprinderea luminilor din bord)
## sau Power-Down (oprire motoare pentru plutire silențioasă în fața planetelor).
func toggle_engine_power() -> bool:
	set_engine_power(not engines_online)
	return engines_online

func set_engine_power(online: bool) -> void:
	if engines_online == online:
		return
	engines_online = online
	_power_sweep_timer = POWER_SEQUENCE_DURATION_SEC
	_power_sweep_direction = 1 if engines_online else -1
	engine_power_toggled.emit(engines_online)

## Redă efectul sonor discret de stație radio (bip + squelch) când pilotul transmite o replică.
func play_radio_comms_squelch() -> void:
	radio_squelch_count += 1
	if radio_comms_player != null and not _is_headless:
		radio_comms_player.pitch_scale = _rng.randf_range(0.96, 1.05)
		radio_comms_player.play()
	radio_comms_squelch_played.emit()

## Redă sunetul profund de bas (1.5 secunde) la Frânarea Gravitațională Automată (`Hyper-Drop`).
func play_hyper_drop_bass() -> void:
	hyper_drop_bass_count += 1
	_hyper_drop_bass_timer = 1.5
	if hyper_drop_player != null and not _is_headless:
		hyper_drop_player.pitch_scale = 1.0
		hyper_drop_player.play()
	hyper_drop_bass_triggered.emit()

## Actualizează în timp real întregul sistem audio al navei.
func update_audio_state(
	delta: float,
	throttle_amount: float,
	propulsion_tier: int,
	angular_velocity: Vector3,
	wants_warp: bool,
	warp_allowed: bool
) -> void:
	if delta <= 0.0:
		return

	# 1. Secvența progresivă Power-Up / Power-Down (tasta E)
	var target_power: float = 1.0 if engines_online else 0.0
	if not is_equal_approx(engine_power_progress, target_power):
		var step_rate: float = delta / maxf(POWER_SEQUENCE_DURATION_SEC, 0.1)
		engine_power_progress = move_toward(engine_power_progress, target_power, step_rate)
		engine_power_progress_changed.emit(engine_power_progress)

	if _power_sweep_timer > 0.0:
		_power_sweep_timer = maxf(0.0, _power_sweep_timer - delta)
		if _power_sweep_timer == 0.0:
			_power_sweep_direction = 0

	# Dacă motoarele sunt oprite, nava plutește în liniște în fața planetelor
	var effective_throttle: float = clampf(throttle_amount, 0.0, 1.0) * engine_power_progress
	current_throttle = effective_throttle

	# 2. Zgomotul de fond al reactorului (Idle Hum)
	if idle_hum_player != null:
		if engine_power_progress > 0.02:
			if not _is_headless and not idle_hum_player.playing:
				idle_hum_player.play()
			idle_hum_player.volume_db = lerpf(-38.0, -10.5, engine_power_progress)
			idle_hum_player.pitch_scale = lerpf(0.55, 1.0 + effective_throttle * 0.12, engine_power_progress)
		else:
			idle_hum_player.volume_db = -60.0

	# 3. Propulsie dinamică (Main Thrusters): pitch_scale 0.8 -> 1.8 și volume_db în timp real
	var tier_bonus: float = 0.0
	if propulsion_tier == 1: # Boost
		tier_bonus = 0.25
	elif propulsion_tier == 2: # Mini-Warp
		tier_bonus = 0.45

	var combined_drive: float = clampf(effective_throttle * 0.75 + tier_bonus * engine_power_progress, 0.0, 1.0)
	var target_pitch: float = lerpf(0.8, 1.8, combined_drive)
	var target_vol_db: float = lerpf(-30.0, -3.5, combined_drive) if engine_power_progress > 0.05 else -60.0

	current_thruster_pitch_scale = lerpf(current_thruster_pitch_scale, target_pitch, clampf(delta * 10.0, 0.0, 1.0))
	current_thruster_volume_db = lerpf(current_thruster_volume_db, target_vol_db, clampf(delta * 10.0, 0.0, 1.0))

	if main_thrusters_player != null:
		main_thrusters_player.pitch_scale = current_thruster_pitch_scale
		main_thrusters_player.volume_db = current_thruster_volume_db

	# 4. Jeturi RCS la rotație (Pitch / Yaw / Roll)
	_rcs_cooldown = maxf(0.0, _rcs_cooldown - delta)
	var rot_mag: float = angular_velocity.length()
	rcs_active = (engines_online and rot_mag > 0.14)
	if rcs_active and _rcs_cooldown <= 0.0 and rcs_jets_player != null:
		rcs_jets_player.pitch_scale = clampf(0.92 + rot_mag * 0.15, 0.85, 1.45)
		rcs_jets_player.volume_db = clampf(lerpf(-18.0, -7.5, rot_mag / 2.5), -20.0, -7.0)
		if not _is_headless:
			rcs_jets_player.play()
		_rcs_cooldown = 0.16

	# 5. Încărcare Mini-Warp (1 secundă) + Tranziție Superluminică
	if engines_online and wants_warp and warp_allowed:
		if not warp_charging and not warp_superluminal_active:
			warp_charging = true
			warp_charge_progress = 0.0
			if warp_drive_player != null:
				warp_drive_player.pitch_scale = 1.0
				if not _is_headless:
					warp_drive_player.play()
			warp_charge_started.emit()

		if warp_charging:
			warp_charge_progress = clampf(warp_charge_progress + delta / WARP_CHARGE_DURATION_SEC, 0.0, 1.0)
			if warp_charge_progress >= 1.0:
				warp_charging = false
				warp_superluminal_active = true
				_warp_boom_timer = 0.65
				warp_transition_boom_triggered.emit()
	else:
		warp_charging = false
		warp_superluminal_active = false
		warp_charge_progress = move_toward(warp_charge_progress, 0.0, delta * 2.5)

	if _warp_boom_timer > 0.0:
		_warp_boom_timer = maxf(0.0, _warp_boom_timer - delta)
	if _hyper_drop_bass_timer > 0.0:
		_hyper_drop_bass_timer = maxf(0.0, _hyper_drop_bass_timer - delta)

	# 6. Umplem bufferul AudioStreamGenerator pentru sinteza în timp real
	_fill_realtime_generator_buffer()

func _fill_realtime_generator_buffer() -> void:
	if _synth_playback == null:
		return
	var frames_available: int = _synth_playback.get_frames_available()
	if frames_available <= 0:
		return

	var frames_to_push: int = mini(frames_available, 512)
	var inv_rate: float = 1.0 / float(SAMPLE_RATE)

	for _i in range(frames_to_push):
		var sample: float = 0.0

		# A) Frecvența ascendentă / descendentă la Power-Up / Power-Down (tasta E)
		if _power_sweep_direction != 0 and _power_sweep_timer > 0.0:
			var t_norm: float = 1.0 - (_power_sweep_timer / POWER_SEQUENCE_DURATION_SEC)
			var sweep_ratio: float = t_norm if _power_sweep_direction > 0 else (1.0 - t_norm)
			var freq: float = lerpf(75.0, 440.0, sweep_ratio * sweep_ratio)
			_synth_phase_a = fmod(_synth_phase_a + freq * inv_rate, 1.0)
			var env: float = sin(t_norm * PI)
			sample += (sin(_synth_phase_a * TAU) * 0.6 + sin(_synth_phase_a * TAU * 1.5) * 0.3) * env * 0.32

		# B) Încărcarea de 1 secundă a Mini-Warp-ului + boom-ul superluminic
		if warp_charging:
			var w_freq: float = lerpf(130.0, 780.0, warp_charge_progress * warp_charge_progress)
			_synth_phase_b = fmod(_synth_phase_b + w_freq * inv_rate, 1.0)
			sample += sin(_synth_phase_b * TAU) * (0.15 + warp_charge_progress * 0.25)
		elif _warp_boom_timer > 0.0:
			var boom_env: float = _warp_boom_timer / 0.65
			var boom_freq: float = lerpf(42.0, 115.0, boom_env)
			_synth_phase_b = fmod(_synth_phase_b + boom_freq * inv_rate, 1.0)
			sample += sin(_synth_phase_b * TAU) * boom_env * 0.48
		elif _hyper_drop_bass_timer > 0.0:
			var drop_env: float = _hyper_drop_bass_timer / 1.5
			var sub_freq: float = lerpf(32.0, 145.0, drop_env * drop_env)
			_synth_phase_b = fmod(_synth_phase_b + sub_freq * inv_rate, 1.0)
			sample += (sin(_synth_phase_b * TAU) * 0.72 + sin(_synth_phase_b * TAU * 0.5) * 0.28) * drop_env * 0.55

		sample = clampf(sample, -0.95, 0.95)
		_synth_playback.push_frame(Vector2(sample, sample))

## Generează în memorie bucla WAV (16-bit PCM) pentru bâzâitul cald al reactorului (Idle Hum).
func _generate_reactor_idle_hum_wav(duration_sec: float) -> AudioStreamWAV:
	var total_samples: int = int(duration_sec * float(SAMPLE_RATE))
	var bytes := PackedByteArray()
	bytes.resize(total_samples * 2)

	for i in range(total_samples):
		var t: float = float(i) / float(SAMPLE_RATE)
		var lfo: float = 0.85 + 0.15 * sin(t * TAU * 1.0)
		var sig: float = (
			sin(t * TAU * 55.0) * 0.52 +
			sin(t * TAU * 110.0) * 0.28 +
			sin(t * TAU * 165.0) * 0.12
		) * lfo
		var pcm16: int = clampi(int(sig * 12000.0), -32767, 32767)
		bytes.encode_s16(i * 2, pcm16)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = total_samples
	wav.data = bytes
	return wav

## Generează în memorie bucla WAV pentru propulsoarele principale (Main Thrusters).
func _generate_main_thruster_loop_wav(duration_sec: float) -> AudioStreamWAV:
	var total_samples: int = int(duration_sec * float(SAMPLE_RATE))
	var bytes := PackedByteArray()
	bytes.resize(total_samples * 2)
	var filtered_noise: float = 0.0

	for i in range(total_samples):
		var t: float = float(i) / float(SAMPLE_RATE)
		var raw_noise: float = _rng.randf_range(-1.0, 1.0)
		filtered_noise = lerpf(filtered_noise, raw_noise, 0.18)
		var turbine: float = (
			sin(t * TAU * 92.0) * 0.42 +
			sin(t * TAU * 184.0) * 0.26 +
			filtered_noise * 0.32
		)
		var pcm16: int = clampi(int(turbine * 14000.0), -32767, 32767)
		bytes.encode_s16(i * 2, pcm16)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = total_samples
	wav.data = bytes
	return wav

## Generează în memorie sunetul scurt de gaz comprimat pentru jeturile RCS la rotație.
func _generate_rcs_burst_wav(duration_sec: float) -> AudioStreamWAV:
	var total_samples: int = int(duration_sec * float(SAMPLE_RATE))
	var bytes := PackedByteArray()
	bytes.resize(total_samples * 2)
	var band_state: float = 0.0

	for i in range(total_samples):
		var progress: float = float(i) / float(max(total_samples, 1))
		var env: float = pow(1.0 - progress, 2.2)
		var white: float = _rng.randf_range(-1.0, 1.0)
		band_state = lerpf(band_state, white, 0.45)
		var hiss: float = (white - band_state * 0.5) * env
		var pcm16: int = clampi(int(hiss * 16000.0), -32767, 32767)
		bytes.encode_s16(i * 2, pcm16)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_DISABLED
	wav.data = bytes
	return wav

## Generează în memorie efectul de încărcare de 1 secundă urmat de tranziția superluminică Mini-Warp.
func _generate_warp_charge_and_boom_wav(duration_sec: float) -> AudioStreamWAV:
	var total_samples: int = int(duration_sec * float(SAMPLE_RATE))
	var bytes := PackedByteArray()
	bytes.resize(total_samples * 2)
	var phase: float = 0.0
	var sub_phase: float = 0.0

	for i in range(total_samples):
		var t: float = float(i) / float(SAMPLE_RATE)
		var sig: float = 0.0
		if t < WARP_CHARGE_DURATION_SEC:
			# Secțiunea 1 (0.0s .. 1.0s): Încărcare ascendentă a bobinelor Warp
			var charge_t: float = t / WARP_CHARGE_DURATION_SEC
			var freq: float = lerpf(140.0, 860.0, charge_t * charge_t)
			phase = fmod(phase + freq / float(SAMPLE_RATE), 1.0)
			sig = (sin(phase * TAU) * 0.65 + sin(phase * TAU * 2.0) * 0.35) * (0.25 + 0.75 * charge_t)
		else:
			# Secțiunea 2 (1.0s .. 2.2s): Boom profund de tranziție superluminică
			var boom_t: float = (t - WARP_CHARGE_DURATION_SEC) / maxf(duration_sec - WARP_CHARGE_DURATION_SEC, 0.1)
			var boom_env: float = pow(clampf(1.0 - boom_t, 0.0, 1.0), 1.65)
			var drop_freq: float = lerpf(135.0, 38.0, clampf(boom_t * 1.4, 0.0, 1.0))
			sub_phase = fmod(sub_phase + drop_freq / float(SAMPLE_RATE), 1.0)
			sig = (sin(sub_phase * TAU) * 0.78 + sin(sub_phase * TAU * 3.0) * 0.22) * boom_env
		var pcm16: int = clampi(int(sig * 18000.0), -32767, 32767)
		bytes.encode_s16(i * 2, pcm16)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_DISABLED
	wav.data = bytes
	return wav

## Generează în memorie sunetul discret de stație radio (dublu-bip + squelch scurt) pentru Comunicații Pilot.
func _generate_radio_squelch_wav(duration_sec: float) -> AudioStreamWAV:
	var total_samples: int = int(duration_sec * float(SAMPLE_RATE))
	var bytes := PackedByteArray()
	bytes.resize(total_samples * 2)

	for i in range(total_samples):
		var t: float = float(i) / float(SAMPLE_RATE)
		var progress: float = float(i) / float(max(total_samples, 1))
		var env: float = sin(progress * PI)
		var beep_freq: float = 1320.0 if progress < 0.45 else 1760.0
		var tone: float = sin(t * TAU * beep_freq) * 0.55
		var click_noise: float = _rng.randf_range(-1.0, 1.0) * (0.35 if progress < 0.15 or progress > 0.85 else 0.05)
		var sig: float = (tone + click_noise) * env
		var pcm16: int = clampi(int(sig * 11000.0), -32767, 32767)
		bytes.encode_s16(i * 2, pcm16)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_DISABLED
	wav.data = bytes
	return wav

## Generează în memorie sunetul profund de bas (1.5 secunde) pentru Frânarea Gravitațională Automată (`Hyper-Drop`).
func _generate_hyper_drop_bass_wav(duration_sec: float) -> AudioStreamWAV:
	var total_samples: int = int(duration_sec * float(SAMPLE_RATE))
	var bytes := PackedByteArray()
	bytes.resize(total_samples * 2)
	var phase: float = 0.0

	for i in range(total_samples):
		var progress: float = float(i) / float(max(total_samples, 1))
		var env: float = sin(minf(progress * 6.0, 1.0) * PI * 0.5) * pow(1.0 - progress, 1.35)
		var drop_freq: float = lerpf(160.0, 32.0, pow(progress, 0.55))
		phase = fmod(phase + drop_freq / float(SAMPLE_RATE), 1.0)
		var sig: float = (
			sin(phase * TAU) * 0.68 +
			sin(phase * TAU * 0.5) * 0.22 +
			sin(phase * TAU * 2.0) * 0.10
		) * env
		var pcm16: int = clampi(int(sig * 21000.0), -32767, 32767)
		bytes.encode_s16(i * 2, pcm16)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_DISABLED
	wav.data = bytes
	return wav

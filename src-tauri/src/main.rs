// SPDX-License-Identifier: GPL-3.0-or-later
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

/// Comandă nativă Tauri pentru comutarea modului Fullscreen (F11) pentru proiecția la clasă.
#[tauri::command]
fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let is_full = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_full)
        .map_err(|e| e.to_string())?;
    Ok(!is_full)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![toggle_fullscreen])
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.set_title("Orbitar — Planetariu Didactic Interactiv");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Eroare la pornirea aplicației desktop Orbitar (Tauri)");
}

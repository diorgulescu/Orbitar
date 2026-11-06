// SPDX-License-Identifier: GPL-3.0-or-later
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    os: String,
    arch: String,
    repository: String,
    releases_url: String,
}

/// Returnează metadatele aplicației desktop (versiune, sistem de operare, arhitectură și link-uri GitHub)
/// pentru caseta „Despre Orbitar” (Help -> About) și verificatorul de actualizări.
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Orbitar".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        repository: "https://github.com/diorgulescu/Orbitar".to_string(),
        releases_url: "https://github.com/diorgulescu/Orbitar/releases".to_string(),
    }
}

/// Deschide o adresă URL oficială (GitHub Releases sau orbitar.ro) în browserul implicit al sistemului
/// (Linux `xdg-open`, Windows `rundll32 url.dll,FileProtocolHandler`, macOS `open`).
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    let is_allowed_domain = trimmed.starts_with("https://github.com/diorgulescu/Orbitar")
        || trimmed.starts_with("https://orbitar.ro");
    let has_unsafe_chars = trimmed
        .chars()
        .any(|c| c.is_control() || c.is_whitespace() || c == '"' || c == '\'');

    if !is_allowed_domain || has_unsafe_chars {
        return Err("URL extern nepermis din motive de securitate.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", trimmed])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Comandă nativă Tauri pentru comutarea modului Fullscreen (F11) pentru proiecția la clasă.
#[tauri::command]
fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let is_full = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_full)
        .map_err(|e| e.to_string())?;
    Ok(!is_full)
}

/// Comandă nativă Tauri pentru deschiderea dialogului de imprimare al sistemului de operare
/// (necesară pe macOS WKWebView, unde `window.print()` din JS este ignorat implicit).
#[tauri::command]
fn print_sheet(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// Salvează o planșă de colorat (.svg sau .png) direct în dosarul Downloads al utilizatorului.
#[tauri::command]
fn save_export_file(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let safe_name: String = filename
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let final_name = if safe_name.is_empty() {
        "orbitar-plansa-colorat.svg".to_string()
    } else {
        safe_name
    };

    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());

    let downloads_dir = {
        let candidate = home_dir.join("Downloads");
        if candidate.is_dir() {
            candidate
        } else {
            let desktop = home_dir.join("Desktop");
            if desktop.is_dir() {
                desktop
            } else {
                home_dir
            }
        }
    };

    let target_path = downloads_dir.join(&final_name);
    fs::write(&target_path, &bytes).map_err(|e| e.to_string())?;
    Ok(target_path.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            toggle_fullscreen,
            print_sheet,
            save_export_file,
            get_app_info,
            open_external_url
        ])
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.set_title("Orbitar — Planetariu Didactic Interactiv");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Eroare la pornirea aplicației desktop Orbitar (Tauri)");
}

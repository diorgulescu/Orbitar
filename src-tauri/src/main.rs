// SPDX-License-Identifier: GPL-3.0-or-later
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
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
            save_export_file
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

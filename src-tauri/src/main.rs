#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate directories;
use std::fs;

use directories::{BaseDirs, ProjectDirs, UserDirs};
use unzpack::Unzpack;

#[tauri::command]
fn unzip(path: String, outdir: String) -> String {
    if let Ok(_) = unzpack::Unzpack::extract(path, outdir) {
        "succeeded".to_string()
    } else {
        "failed".to_string()
    }
}

#[tauri::command]
async fn download(url: String, path: String) -> String {
    use download_rs::async_download::Download;
    let download = Download::new(url.as_str(), Some(path.as_str()), None);
    match download.download_async().await {
        Err(e) => "failed".to_string(),
        Ok(()) => "succeeded".to_string(),
    }
}

#[tauri::command]
fn get_config_dir() -> Option<String> {
    let addr = format!(
        "{}/",
        ProjectDirs::from("cc", "MicroBlock", "DanMMaku")?
            .config_dir()
            .to_str()?
    );
    fs::create_dir_all(&addr);
    Some(addr)
}

#[tauri::command]
fn open(sth: String) {
    open::that(sth);
}

fn main() {
    let context = tauri::generate_context!();
    tauri::Builder::default()
        .menu(if cfg!(target_os = "macos") {
            tauri::Menu::os_default(&context.package_info().name)
        } else {
            tauri::Menu::default()
        })
        .invoke_handler(tauri::generate_handler![get_config_dir, open, unzip, download])
        .run(context)
        .expect("error while running tauri application");
}

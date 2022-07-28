#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate directories;
use std::{fs, thread};
mod websocket_forwarder;
use crate::websocket_forwarder::WsForwardServer;
use directories::{BaseDirs, ProjectDirs, UserDirs};
use tauri::{AppHandle, window, Window};
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

#[tauri::command]
async fn create_window_with_script(handle:AppHandle,tag:String,urll:String,code_to_inject: String) {
    // window.eval(&code_to_inject);
    tauri::WindowBuilder::new(&handle,tag, tauri::WindowUrl::External(url::Url::parse(urll.as_str()).unwrap()))
                            .initialization_script(&format!("{}",code_to_inject))
                            .build()
                            .unwrap();
}


fn main() {
    let context = tauri::generate_context!();
    
    thread::spawn(||{
        WsForwardServer::listen(6812);
    });

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_config_dir,
            open,
            unzip,
            download,
            create_window_with_script
        ])
        .run(context)
        .expect("error while running tauri application");
}

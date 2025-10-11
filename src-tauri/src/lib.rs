use axum::{routing::get, Router};
use core::panic;
use keyring::{Entry, Result as KeyringResult};
use libloading::Library;
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::{LazyLock, Mutex, OnceLock};
use std::thread;
use sys_locale::get_locale;
use tauri::{LogicalSize, Size, Window};
use tokio::sync::oneshot;

static BEFORE_WINDOW_SIZE: OnceLock<(u32, u32)> = OnceLock::new();
static AXUM_SERVER_RUNNING: LazyLock<AtomicBool> = LazyLock::new(|| AtomicBool::new(false));
static AXUM_SERVER_SHUTDOWN: OnceLock<Mutex<Option<oneshot::Sender<()>>>> = OnceLock::new();
#[tauri::command]
async fn start_axum_server(port: u16) -> Result<(), String> {
    if AXUM_SERVER_RUNNING.load(Ordering::Relaxed) {
        return Err("Server is already running".to_string());
    }

    let (tx, rx) = oneshot::channel::<()>();
    AXUM_SERVER_SHUTDOWN
        .set(Mutex::new(Some(tx)))
        .map_err(|_| "Failed to set shutdown channel")?;

    let app = Router::new()
        .route("/", get(handler))
        .route("/callback", get(oauth_callback_handler));

    AXUM_SERVER_RUNNING.store(true, Ordering::Relaxed);

    tokio::spawn(async move {
        let addr = format!("127.0.0.1:{}", port);
        let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
        println!("listening on {}", listener.local_addr().unwrap());

        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .unwrap();

        AXUM_SERVER_RUNNING.store(false, Ordering::Relaxed);
    });

    Ok(())
}
async fn oauth_callback_handler(
    query: axum::extract::Query<HashMap<String, String>>,
) -> &'static str {
    if let Some(code) = query.get("code") {
        // Use the same token exchange process as get_token_from_auth
        let client = Client::new();
        let url = "http://localhost:3030/authorize";

        let mut params = HashMap::new();
        params.insert("code", code.clone());

        match client.post(url).json(&params).send().await {
            Ok(response) => {
                match response.text().await {
                    Ok(token) => {
                        // Save token using keyring
                        if let Err(e) = save_token_to_keyring(&token) {
                            eprintln!("Failed to save token: {}", e);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to read response: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("Request failed: {}", e);
            }
        }
    }
    "Authorization complete. You can close this window."
}
#[tauri::command]
async fn get_token_from_auth(code: String) -> Result<String, String> {
    let client = Client::new();
    let url = "http://localhost:3030/authorize";

    let mut params = HashMap::new();
    params.insert("code", code);

    let response = client
        .post(url)
        .json(&params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let token = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(token)
}

async fn exchange_code_for_token(code: &str) -> Result<String, String> {
    // Implement OAuth token exchange logic here
    // This is a placeholder - replace with actual OAuth implementation
    Ok(format!("token_for_{}", code))
}

fn save_token_to_keyring(token: &str) -> KeyringResult<()> {
    let entry = Entry::new("fumen-rs", "oauth-token")?;
    entry.set_password(token)?;
    Ok(())
}

#[tauri::command]
async fn stop_axum_server() -> Result<(), String> {
    if !AXUM_SERVER_RUNNING.load(Ordering::Relaxed) {
        return Err("Server is not running".to_string());
    }

    if let Some(shutdown_guard) = AXUM_SERVER_SHUTDOWN.get() {
        if let Ok(mut shutdown) = shutdown_guard.lock() {
            if let Some(tx) = shutdown.take() {
                let _ = tx.send(());
                return Ok(());
            }
        }
    }

    Err("Failed to stop server".to_string())
}

async fn handler() -> &'static str {
    "Hello, World!"
}

#[tauri::command]
async fn trigger_oauth() -> Result<String, String> {
    // OAuth trigger logic here
    Ok("OAuth triggered".to_string())
}

#[tauri::command]
fn get_folder_children_absolute_path(folder_path: String) -> Vec<String> {
    let path = PathBuf::from(folder_path);
    let mut children_paths = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(path_str) = entry.path().to_str() {
                    children_paths.push(path_str.to_string());
                }
            }
        }
    }

    children_paths
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("aHello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_redirect_url(url: &str) -> Result<String, String> {
    let client = Client::new();
    let response = client.head(url).send().await.map_err(|e| e.to_string())?;
    let url = response.url().to_string();

    Ok(url)
}

#[tauri::command]
fn delete_config_file_if_available() {
    match std::env::current_exe() {
        Ok(path) => {
            let config_file_path = path.parent().unwrap().join("config.json");
            if config_file_path.exists() {
                fs::remove_file(config_file_path).unwrap();
            }
        }
        Err(_) => {}
    }
}

#[tauri::command]
fn reveal_config_file_in_explorer() {
    match std::env::current_exe() {
        Ok(path) => {
            let config_file_path = path.parent().unwrap();
            if config_file_path.exists() {
                showfile::show_path_in_file_manager(path.parent().unwrap());
            }
        }
        Err(_) => {}
    }
}

#[tauri::command]
fn get_language() -> String {
    let locale = get_locale().unwrap_or_else(|| String::from("en-US"));
    return locale;
}

#[tauri::command]
fn get_bot_dlls() -> Vec<String> {
    let mut dll_names = Vec::new();
    if let Ok(exe_path) = std::env::current_exe() {
        let bot_dir: PathBuf = exe_path.parent().unwrap().join("assets").join("bot");
        if let Ok(entries) = fs::read_dir(bot_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path: PathBuf = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("dll") {
                        if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                            dll_names.push(file_stem.to_string());
                        }
                    }
                }
            }
        }
    }
    dll_names
}
static LIBRARY_CACHE: LazyLock<Mutex<HashMap<String, Arc<Mutex<Library>>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

unsafe fn load_library(bot_name: &str) -> Result<Arc<Mutex<Library>>, String> {
    let best_bot = format!("assets/bot/{}.dll", bot_name);
    let mut cache = LIBRARY_CACHE.lock().unwrap();
    let bot_lib = cache.get(bot_name);

    match bot_lib {
        Some(lib_arc) => Ok(Arc::clone(lib_arc)),
        None => {
            let new_lib =
                Library::new(&best_bot).map_err(|e| format!("Failed to load library: {}", e))?;
            let new_lib_arc = Arc::new(Mutex::new(new_lib));
            cache.insert(bot_name.to_string(), Arc::clone(&new_lib_arc));
            Ok(new_lib_arc)
        }
    }
}
/// 現在のWindow情報を初期化
#[tauri::command]
fn initialize_window(window: Window) {
    let current_size = window.outer_size().unwrap();
    BEFORE_WINDOW_SIZE
        .set((current_size.width, current_size.height))
        .ok();

    let args: Vec<String> = std::env::args().collect();
}

#[tauri::command]
fn get_args() -> Vec<String> {
    let args: Vec<String> = std::env::args().collect();
    args
}

#[tauri::command]
fn adjust_window_size(window: Window) {
    let current_size = window.outer_size().unwrap();
    let scale_factor = window.scale_factor().unwrap();

    let (old_width, old_height) = BEFORE_WINDOW_SIZE.get().unwrap();

    let new_width = current_size.width as f64;
    let new_height = current_size.height as f64;
    let old_width = *old_width as f64;
    let old_height = *old_height as f64;
    let aspect = old_width / old_height;

    let (final_width, final_height) =
        if (new_width - old_width).abs() > (new_height - old_height).abs() {
            let height = new_width / aspect;
            (new_width, height)
        } else {
            let width = new_height * aspect;
            (width, new_height)
        };

    window
        .set_size(Size::Logical(LogicalSize {
            width: final_width / scale_factor,
            height: final_height / scale_factor,
        }))
        .unwrap();

    BEFORE_WINDOW_SIZE
        .set((final_width as u32, final_height as u32))
        .ok();
}

#[tauri::command]
fn set_window_size(window: Window, width: f64, height: f64) {
    let scale_factor = window.scale_factor().unwrap();
    window
        .set_size(Size::Logical(LogicalSize {
            width: width / scale_factor,
            height: height / scale_factor,
        }))
        .unwrap();
}

#[tauri::command]
fn get_window_size(window: Window) -> (u32, u32) {
    let current_size = window.outer_size().unwrap();

    let width = (current_size.width) as u32;
    let height = (current_size.height) as u32;
    (width, height)
}

#[tauri::command]
async fn search_bot_best(
    bot_name: String,
    field: String,
    hold: String,
    b2b: bool,
    mut combo: i32,
    pieces: String,
    incoming: i32,
) -> Result<[u8; 9], String> {
    unsafe {
        let lib = load_library(&bot_name)?;
        let lib_lock = lib.lock().unwrap();

        // println!("Loading bot: assets/bot/{}.dll", bot_name);
        let cc_search: libloading::Symbol<
            unsafe extern "C" fn(
                *const std::os::raw::c_char,
                *const std::os::raw::c_char,
                bool,
                u32,
                *const std::os::raw::c_char,
                u32,
                *mut [u8; 9],
            ),
        > = match lib_lock.get(b"cc_search\0") {
            Ok(symbol) => symbol,
            Err(e) => return Err(format!("Failed to load symbol: {}", e)),
        };

        if combo == -1 {
            combo = 0;
        }

        let field_c = std::ffi::CString::new(field)
            .map_err(|e| format!("Field contains null byte: {}", e))?;
        let hold_c =
            std::ffi::CString::new(hold).map_err(|e| format!("Hold contains null byte: {}", e))?;
        let pieces_c = std::ffi::CString::new(pieces)
            .map_err(|e| format!("Pieces contains null byte: {}", e))?;

        let mut result: [u8; 9] = [0; 9];

        //  dbg!(&field_c, &hold_c, b2b, combo, &pieces_c, incoming);

        cc_search(
            field_c.as_ptr(),
            hold_c.as_ptr(),
            b2b,
            combo as u32,
            pieces_c.as_ptr(),
            incoming as u32,
            &mut result,
        );

        Ok(result)
    }
}

fn candle() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("fumenrslogin", move |_app, request| {
            panic!("Called custom protocol");
            println!("Scheme: {}", request.uri());
            println!("Method: {}", request.method());
            println!("Headers: {:?}", request.headers());

            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", "text/html")
                .body("OK".as_bytes().to_vec())
                .unwrap()
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_bot_dlls,
            search_bot_best,
            get_redirect_url,
            get_language,
            delete_config_file_if_available,
            reveal_config_file_in_explorer,
            adjust_window_size,
            initialize_window,
            set_window_size,
            get_window_size,
            get_folder_children_absolute_path,
            get_args,
            start_axum_server,
            stop_axum_server,
            trigger_oauth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

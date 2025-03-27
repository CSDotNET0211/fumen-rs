use libloading::Library;
use reqwest::Client;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::{LazyLock, Mutex};
use std::vec;
use sys_locale::get_locale;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
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

        println!("Loading bot: assets/bot/{}.dll", bot_name);

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

        dbg!(&field_c, &hold_c, b2b, combo, &pieces_c, incoming);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        /*  .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |_app, shortcut, event| {
                    let ctrl_n_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyA);
                    println!("{:?}", shortcut);
                    if shortcut == &ctrl_n_shortcut {
                        match event.state() {
                            ShortcutState::Pressed => {
                                println!("Ctrl-N Pressed!");
                            }
                            ShortcutState::Released => {
                                println!("Ctrl-N Released!");
                            }
                        }
                    }
                })
                .build(),
        )*/
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_bot_dlls,
            search_bot_best,
            get_redirect_url,
            get_language,
            delete_config_file_if_available,
            reveal_config_file_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

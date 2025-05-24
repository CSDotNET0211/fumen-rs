use candle_core::Device;
use candle_nn::Linear;
use libloading::Library;
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::{LazyLock, Mutex, OnceLock};
use std::vec;
use sys_locale::get_locale;
use tauri::{LogicalSize, Size, Window};

mod model;

static before_window_size: OnceLock<(u32, u32)> = OnceLock::new();

#[tauri::command]
fn test() {
    return;
    let mut rng = rand::thread_rng();
    let random_vec: Vec<f32> = (0..600).map(|_| rng.gen_range(0.0..1.0)).collect();
    model::test(&random_vec);
}

#[tauri::command]
fn train_data(values: Vec<Vec<f32>>) {
    let mut model = model::Model::default();
    model.train(values);
}

#[tauri::command]
fn guess_data(values: Vec<f32>) {
    let model = model::Model::load("model.bin", &Device::Cpu).unwrap();

    let result = model.predict(&values).unwrap();
    dbg!(&result);
    //model.train(values);
}

#[tauri::command]
fn get_train_data_path(folder_path: String) -> HashMap<String, Vec<String>> {
    let mut folder_map = HashMap::new();
    let base_path = PathBuf::from(folder_path);

    if let Ok(entries) = fs::read_dir(&base_path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    let folder_name = path.file_name().unwrap().to_string_lossy().to_string();
                    let mut file_list = Vec::new();

                    if let Ok(sub_entries) = fs::read_dir(&path) {
                        for sub_entry in sub_entries {
                            if let Ok(sub_entry) = sub_entry {
                                let sub_path = sub_entry.path();
                                if sub_path.is_file() {
                                    if let Some(file_name) = sub_path.file_name() {
                                        file_list.push(file_name.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }

                    folder_map.insert(folder_name, file_list);
                }
            }
        }
    }

    folder_map
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
#[tauri::command]
fn initialize_window(window: Window) {
    let current_size = window.outer_size().unwrap();
    before_window_size
        .set((current_size.width, current_size.height))
        .ok();
}

#[tauri::command]
fn adjust_window_size(window: Window) {
    let current_size = window.outer_size().unwrap();
    let scale_factor = window.scale_factor().unwrap();

    let (old_width, old_height) = before_window_size.get().unwrap();

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

    before_window_size
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
            test,
            get_train_data_path,
            train_data,
            guess_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

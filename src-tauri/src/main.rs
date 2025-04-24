// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    unsafe {
        winapi::um::shellscalingapi::SetProcessDpiAwareness(2);
    }
    fumen_lib::run()
}

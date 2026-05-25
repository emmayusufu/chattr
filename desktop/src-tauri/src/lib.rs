mod input;

#[tauri::command]
fn inject_mouse(x: f64, y: f64, button: &str, action: &str) -> Result<(), String> {
    input::mouse_event(x, y, button, action).map_err(|e| e.to_string())
}

#[tauri::command]
fn inject_key(key: &str, action: &str) -> Result<(), String> {
    input::key_event(key, action).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_google_auth::init())
        .invoke_handler(tauri::generate_handler![inject_mouse, inject_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod input;

#[tauri::command]
fn inject_mouse(x: i32, y: i32, button: u8, pressed: bool) -> Result<(), String> {
    input::mouse_event(x, y, button, pressed).map_err(|e| e.to_string())
}

#[tauri::command]
fn inject_key(keycode: u32, pressed: bool) -> Result<(), String> {
    input::key_event(keycode, pressed).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![inject_mouse, inject_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

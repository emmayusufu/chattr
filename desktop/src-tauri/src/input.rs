#[cfg(target_os = "macos")]
mod macos {
    use core_graphics::display::CGDisplay;
    use core_graphics::event::{
        CGEvent, CGEventTapLocation, CGEventType, CGMouseButton,
    };
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use core_graphics::geometry::CGPoint;
    use std::error::Error;

    fn event_source() -> Result<CGEventSource, Box<dyn Error>> {
        CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| "failed to create event source".into())
    }

    fn screen_size() -> (f64, f64) {
        let display = CGDisplay::main();
        (display.pixels_wide() as f64, display.pixels_high() as f64)
    }

    pub fn mouse_event(
        norm_x: f64,
        norm_y: f64,
        button: &str,
        action: &str,
    ) -> Result<(), Box<dyn Error>> {
        let (sw, sh) = screen_size();
        let point = CGPoint::new(norm_x * sw, norm_y * sh);
        let source = event_source()?;

        let (event_type, mouse_button) = match (button, action) {
            ("left", "down") => (CGEventType::LeftMouseDown, CGMouseButton::Left),
            ("left", "up") => (CGEventType::LeftMouseUp, CGMouseButton::Left),
            ("left", "move") => (CGEventType::MouseMoved, CGMouseButton::Left),
            ("right", "down") => (CGEventType::RightMouseDown, CGMouseButton::Right),
            ("right", "up") => (CGEventType::RightMouseUp, CGMouseButton::Right),
            _ => return Err(format!("unknown mouse action: {} {}", button, action).into()),
        };

        let event = CGEvent::new_mouse_event(source, event_type, point, mouse_button)
            .map_err(|_| "failed to create mouse event")?;
        event.post(CGEventTapLocation::HID);
        Ok(())
    }

    pub fn key_event(key: &str, action: &str) -> Result<(), Box<dyn Error>> {
        let source = event_source()?;
        let keycode = key_to_code(key).ok_or(format!("unknown key: {}", key))?;
        let down = match action {
            "down" => true,
            "up" => false,
            _ => return Err(format!("unknown key action: {}", action).into()),
        };

        let event = CGEvent::new_keyboard_event(source, keycode, down)
            .map_err(|_| "failed to create key event")?;
        event.post(CGEventTapLocation::HID);
        Ok(())
    }

    fn key_to_code(key: &str) -> Option<u16> {
        Some(match key {
            "Return" | "Enter" => 0x24,
            "Tab" => 0x30,
            "Space" | " " => 0x31,
            "Backspace" => 0x33,
            "Escape" => 0x35,
            "ArrowLeft" => 0x7B,
            "ArrowRight" => 0x7C,
            "ArrowDown" => 0x7D,
            "ArrowUp" => 0x7E,
            "a" | "A" => 0x00, "s" | "S" => 0x01, "d" | "D" => 0x02,
            "f" | "F" => 0x03, "h" | "H" => 0x04, "g" | "G" => 0x05,
            "z" | "Z" => 0x06, "x" | "X" => 0x07, "c" | "C" => 0x08,
            "v" | "V" => 0x09, "b" | "B" => 0x0B, "q" | "Q" => 0x0C,
            "w" | "W" => 0x0D, "e" | "E" => 0x0E, "r" | "R" => 0x0F,
            "y" | "Y" => 0x10, "t" | "T" => 0x11, "1" => 0x12,
            "2" => 0x13, "3" => 0x14, "4" => 0x15, "6" => 0x16,
            "5" => 0x17, "9" => 0x19, "7" => 0x1A, "8" => 0x1C,
            "0" => 0x1D, "o" | "O" => 0x1F, "u" | "U" => 0x20,
            "i" | "I" => 0x22, "p" | "P" => 0x23, "l" | "L" => 0x25,
            "j" | "J" => 0x26, "k" | "K" => 0x28, "n" | "N" => 0x2D,
            "m" | "M" => 0x2E,
            _ => return None,
        })
    }
}

#[cfg(target_os = "macos")]
pub use macos::{mouse_event, key_event};

#[cfg(not(target_os = "macos"))]
pub fn mouse_event(_x: f64, _y: f64, _button: &str, _action: &str) -> Result<(), Box<dyn std::error::Error>> {
    Err("remote control not supported on this platform yet".into())
}

#[cfg(not(target_os = "macos"))]
pub fn key_event(_key: &str, _action: &str) -> Result<(), Box<dyn std::error::Error>> {
    Err("remote control not supported on this platform yet".into())
}

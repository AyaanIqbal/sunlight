use super::types::ScreenCapturePermission;

const BUNDLE_ID: &str = "com.rawsabsaid.sunset-lamp-controller";

pub fn screen_capture_denied_message() -> String {
    format!(
        "Ambient Mode needs Screen Recording permission to sample display colors. \
         In System Settings → Privacy & Security → Screen Recording, enable \"Sunset Lamp Controller\" \
         (bundle id: {BUNDLE_ID}). If you already enabled it, quit and reopen the app — \
         macOS only applies the grant after a restart."
    )
}

#[cfg(target_os = "macos")]
fn can_capture_screen() -> bool {
    if core_graphics::access::ScreenCaptureAccess::default().preflight() {
        return true;
    }
    probe_screen_capture()
}

#[cfg(target_os = "macos")]
fn probe_screen_capture() -> bool {
    xcap::Monitor::all()
        .ok()
        .and_then(|monitors| monitors.into_iter().next())
        .and_then(|monitor| monitor.capture_image().ok())
        .is_some()
}

#[cfg(target_os = "macos")]
pub fn check_screen_capture_permission() -> ScreenCapturePermission {
    if can_capture_screen() {
        ScreenCapturePermission::Granted
    } else {
        ScreenCapturePermission::Denied
    }
}

#[cfg(target_os = "macos")]
pub fn request_screen_capture_permission() -> ScreenCapturePermission {
    let access = core_graphics::access::ScreenCaptureAccess::default();
    if access.request() || can_capture_screen() {
        ScreenCapturePermission::Granted
    } else {
        ScreenCapturePermission::Denied
    }
}

#[cfg(not(target_os = "macos"))]
pub fn check_screen_capture_permission() -> ScreenCapturePermission {
    ScreenCapturePermission::Denied
}

#[cfg(not(target_os = "macos"))]
pub fn request_screen_capture_permission() -> ScreenCapturePermission {
    ScreenCapturePermission::Denied
}

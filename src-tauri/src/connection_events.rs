use crate::state::ConnectionStatus;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn init_connection_events(app: AppHandle) {
    let _ = APP_HANDLE.set(app);
}

pub fn emit_connection_status(status: &ConnectionStatus) {
    let Some(app) = APP_HANDLE.get() else {
        return;
    };
    let _ = app.emit(
        "connection://status",
        serde_json::json!({ "status": status }),
    );
}

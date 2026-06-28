mod ambient;
mod errors;
mod lamp;
mod protocol;
mod reconnect;
mod state;
mod store;

use crate::ambient::{
    check_screen_capture_permission, request_screen_capture_permission, stop_ambient_engine,
    AmbientEngine, AmbientSettings, AmbientStatus, AmbientStopReason, ScreenCapturePermission,
    SharedAmbientEngine,
};
use crate::errors::LampError;
use crate::lamp::disconnect_peripheral;
use crate::reconnect::{perform_connect, write_color_if_connected};
use crate::state::{ConnectMode, ConnectionStatus, LampState, SharedLampState};
use crate::store::AppState;

use btleplug::api::Peripheral as _;
use std::sync::Arc;
use tauri::{AppHandle, RunEvent, State};
use tokio::sync::Mutex;

async fn sync_status_with_peripheral(state: &SharedLampState) -> ConnectionStatus {
    let mut s = state.lock().await;

    if s.reconnect_in_progress {
        return s.status.clone();
    }

    if matches!(
        s.status,
        ConnectionStatus::Scanning
            | ConnectionStatus::Connecting
            | ConnectionStatus::Reconnecting
    ) {
        return s.status.clone();
    }

    if let Some(ref p) = s.peripheral {
        match p.is_connected().await {
            Ok(true) => {
                if s.status != ConnectionStatus::Connected {
                    s.status = ConnectionStatus::Connected;
                }
                return ConnectionStatus::Connected;
            }
            _ => {
                if s.status == ConnectionStatus::Connected {
                    s.status = ConnectionStatus::Stale;
                    s.peripheral.take();
                }
                return s.status.clone();
            }
        }
    }

    s.status.clone()
}

#[tauri::command]
async fn connect_lamp(state: State<'_, SharedLampState>) -> Result<(), LampError> {
    {
        let mut s = state.lock().await;
        s.user_disconnected = false;
        s.reconnect_attempts = 0;
    }
    perform_connect(&state, ConnectMode::Manual).await
}

#[tauri::command]
async fn disconnect_lamp(
    state: State<'_, SharedLampState>,
    ambient: State<'_, SharedAmbientEngine>,
    app: AppHandle,
) -> Result<(), LampError> {
    stop_ambient_engine(
        ambient.inner(),
        Some(&app),
        AmbientStopReason::Disconnect,
        None,
    )
    .await;

    let peripheral = {
        let mut s = state.lock().await;
        s.peripheral.take()
    };
    if let Some(p) = peripheral {
        disconnect_peripheral(&p).await;
    }
    let mut s = state.lock().await;
    s.status = ConnectionStatus::Disconnected;
    s.user_disconnected = true;
    s.reconnect_in_progress = false;
    Ok(())
}

#[tauri::command]
async fn reconnect_lamp(state: State<'_, SharedLampState>) -> Result<(), LampError> {
    {
        let mut s = state.lock().await;
        s.user_disconnected = false;
    }
    perform_connect(&state, ConnectMode::Reconnect).await
}

#[tauri::command]
async fn refresh_bluetooth(state: State<'_, SharedLampState>) -> Result<(), LampError> {
    {
        let mut s = state.lock().await;
        s.user_disconnected = false;
        s.reconnect_attempts = 0;
    }
    perform_connect(&state, ConnectMode::Refresh).await
}

#[tauri::command]
async fn get_connection_status(
    state: State<'_, SharedLampState>,
) -> Result<ConnectionStatus, LampError> {
    Ok(sync_status_with_peripheral(&state).await)
}

#[tauri::command]
async fn verify_connection(state: State<'_, SharedLampState>) -> Result<ConnectionStatus, LampError> {
    Ok(sync_status_with_peripheral(&state).await)
}

#[tauri::command]
async fn set_color(
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
    state: State<'_, SharedLampState>,
) -> Result<(), LampError> {
    write_color_if_connected(&state, r, g, b, brightness).await
}

#[tauri::command]
async fn get_known_device() -> Result<String, LampError> {
    Ok("SSL-99A4C3".to_string())
}

#[tauri::command]
async fn load_state(app: AppHandle) -> Result<Option<AppState>, String> {
    Ok(store::load(&app))
}

#[tauri::command]
async fn save_state(app: AppHandle, state: AppState) -> Result<(), String> {
    store::save(&app, &state)
}

#[tauri::command]
fn ambient_check_permission() -> ScreenCapturePermission {
    check_screen_capture_permission()
}

#[tauri::command]
fn ambient_request_permission() -> ScreenCapturePermission {
    request_screen_capture_permission()
}

#[tauri::command]
async fn ambient_get_status(ambient: State<'_, SharedAmbientEngine>) -> Result<AmbientStatus, String> {
    let eng = ambient.lock().await;
    Ok(eng.status())
}

#[tauri::command]
async fn ambient_start(
    settings: AmbientSettings,
    brightness: u8,
    ambient: State<'_, SharedAmbientEngine>,
    lamp_state: State<'_, SharedLampState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut eng = ambient.lock().await;
    eng.start(app, lamp_state.inner().clone(), settings, brightness)
        .await?;
    Ok(())
}

#[tauri::command]
async fn ambient_stop(
    ambient: State<'_, SharedAmbientEngine>,
    app: AppHandle,
) -> Result<(), String> {
    stop_ambient_engine(
        ambient.inner(),
        Some(&app),
        AmbientStopReason::User,
        None,
    )
    .await;
    Ok(())
}

#[tauri::command]
async fn ambient_update_settings(
    settings: AmbientSettings,
    brightness: Option<u8>,
    ambient: State<'_, SharedAmbientEngine>,
) -> Result<(), String> {
    let eng = ambient.lock().await;
    eng.update_settings(settings, brightness).await;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let lamp_state: SharedLampState = Arc::new(Mutex::new(LampState::new()));
    let ambient_engine: SharedAmbientEngine = Arc::new(Mutex::new(AmbientEngine::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(lamp_state.clone())
        .manage(ambient_engine.clone())
        .invoke_handler(tauri::generate_handler![
            connect_lamp,
            disconnect_lamp,
            reconnect_lamp,
            refresh_bluetooth,
            verify_connection,
            get_connection_status,
            set_color,
            get_known_device,
            load_state,
            save_state,
            ambient_check_permission,
            ambient_request_permission,
            ambient_get_status,
            ambient_start,
            ambient_stop,
            ambient_update_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(move |app_handle, event| {
            if let RunEvent::Exit = event {
                let ambient = ambient_engine.clone();
                let app = app_handle.clone();
                tauri::async_runtime::block_on(async {
                    let _ = tokio::time::timeout(
                        std::time::Duration::from_secs(2),
                        stop_ambient_engine(
                            &ambient,
                            Some(&app),
                            AmbientStopReason::User,
                            None,
                        ),
                    )
                    .await;
                });
            }
        });
}

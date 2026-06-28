mod errors;
mod lamp;
mod protocol;
mod reconnect;
mod state;
mod store;

use crate::errors::LampError;
use crate::lamp::{disconnect_peripheral, write_color};
use crate::reconnect::{mark_stale, perform_connect, spawn_auto_reconnect};
use crate::state::{ConnectMode, ConnectionStatus, LampState, SharedLampState};
use crate::store::AppState;

use btleplug::api::Peripheral as _;
use std::sync::Arc;
use tauri::{AppHandle, State};
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
async fn disconnect_lamp(state: State<'_, SharedLampState>) -> Result<(), LampError> {
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
    if brightness > 64 {
        return Err(LampError::InvalidValue(format!(
            "brightness must be 0–64, got {brightness}"
        )));
    }

    let write_result = {
        let s = state.lock().await;
        if s.status != ConnectionStatus::Connected {
            if matches!(s.status, ConnectionStatus::Stale | ConnectionStatus::Reconnecting) {
                return Err(LampError::ConnectionStale);
            }
            return Err(LampError::NotConnected);
        }
        let peripheral = match s.peripheral.as_ref() {
            Some(p) => p,
            None => return Err(LampError::NotConnected),
        };
        let char_uuid = s.characteristic_uuid;

        if let Ok(false) = peripheral.is_connected().await {
            drop(s);
            mark_stale(&state).await;
            spawn_auto_reconnect(state.inner().clone());
            return Err(LampError::ConnectionStale);
        }

        write_color(peripheral, char_uuid, r, g, b, brightness).await
    };

    match write_result {
        Ok(()) => Ok(()),
        Err(e) => {
            mark_stale(&state).await;
            spawn_auto_reconnect(state.inner().clone());
            Err(e)
        }
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let lamp_state: SharedLampState = Arc::new(Mutex::new(LampState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(lamp_state)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

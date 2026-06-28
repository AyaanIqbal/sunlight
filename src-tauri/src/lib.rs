mod errors;
mod lamp;
mod protocol;
mod state;
mod store;

use crate::errors::LampError;
use crate::lamp::{connect_peripheral, disconnect_peripheral, scan_for_lamp, write_color};
use crate::state::{ConnectionStatus, LampState, SharedLampState};
use crate::store::AppState;

use btleplug::api::Peripheral as _;
use std::time::Duration;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use tokio::time::sleep;

// ─── Internal connect routine ─────────────────────────────────────────────────

/// Shared by both connect_lamp and reconnect_lamp.
/// Always tears down any existing BLE connection before scanning fresh.
async fn perform_connect(state: &SharedLampState) -> Result<(), LampError> {
    // 1. Take any existing peripheral and disconnect it cleanly
    let existing = {
        let mut s = state.lock().await;
        s.status = ConnectionStatus::Scanning;
        s.peripheral.take()
    };
    if let Some(p) = existing {
        disconnect_peripheral(&p).await;
        drop(p);
        // Give CoreBluetooth a moment to fully release the connection
        sleep(Duration::from_millis(400)).await;
    }

    // 2. Fresh scan
    let peripheral = match scan_for_lamp().await {
        Ok(p) => p,
        Err(e) => {
            let mut s = state.lock().await;
            s.status = ConnectionStatus::Failed;
            return Err(e);
        }
    };

    // 3. Connect
    {
        let mut s = state.lock().await;
        s.status = ConnectionStatus::Connecting;
    }
    if let Err(e) = connect_peripheral(&peripheral).await {
        let mut s = state.lock().await;
        s.status = ConnectionStatus::Failed;
        return Err(e);
    }

    // 4. Store
    let mut s = state.lock().await;
    s.status = ConnectionStatus::Connected;
    s.peripheral = Some(peripheral);
    Ok(())
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn connect_lamp(state: State<'_, SharedLampState>) -> Result<(), LampError> {
    perform_connect(&state).await
}

#[tauri::command]
async fn disconnect_lamp(state: State<'_, SharedLampState>) -> Result<(), LampError> {
    let mut s = state.lock().await;
    if let Some(p) = s.peripheral.take() {
        p.disconnect().await.ok();
    }
    s.status = ConnectionStatus::Disconnected;
    Ok(())
}

#[tauri::command]
async fn reconnect_lamp(state: State<'_, SharedLampState>) -> Result<(), LampError> {
    perform_connect(&state).await
}

#[tauri::command]
async fn get_connection_status(state: State<'_, SharedLampState>) -> Result<ConnectionStatus, LampError> {
    let s = state.lock().await;
    if let Some(ref p) = s.peripheral {
        match p.is_connected().await {
            Ok(true) => return Ok(ConnectionStatus::Connected),
            _ => {
                // Peripheral lost; update state on next write attempt
                return Ok(ConnectionStatus::Disconnected);
            }
        }
    }
    Ok(s.status.clone())
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

    let s = state.lock().await;
    let peripheral = s.peripheral.as_ref().ok_or(LampError::NotConnected)?;
    let char_uuid = s.characteristic_uuid;

    write_color(peripheral, char_uuid, r, g, b, brightness).await
}

#[tauri::command]
async fn get_known_device() -> Result<String, LampError> {
    Ok("SSL-99A4C3".to_string())
}

// ─── Persistence commands ─────────────────────────────────────────────────────

#[tauri::command]
async fn load_state(app: AppHandle) -> Result<Option<AppState>, String> {
    Ok(store::load(&app))
}

#[tauri::command]
async fn save_state(app: AppHandle, state: AppState) -> Result<(), String> {
    store::save(&app, &state)
}

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let lamp_state: SharedLampState = Mutex::new(LampState::new());

    tauri::Builder::default()
        .manage(lamp_state)
        .invoke_handler(tauri::generate_handler![
            connect_lamp,
            disconnect_lamp,
            reconnect_lamp,
            get_connection_status,
            set_color,
            get_known_device,
            load_state,
            save_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

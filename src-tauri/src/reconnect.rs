use crate::errors::LampError;
use crate::lamp::{connect_peripheral, disconnect_peripheral, scan_for_lamp, write_color};
use crate::state::{ConnectMode, ConnectionStatus, SharedLampState};

use btleplug::api::Peripheral as _;

use std::time::{Duration, Instant};
use tokio::time::sleep;

const MAX_RECONNECT_ATTEMPTS: u8 = 3;
const RECONNECT_DELAYS_MS: [u64; 3] = [1000, 2000, 4000];
const COOLDOWN_SECS: u64 = 30;
const TEARDOWN_DELAY_MS: u64 = 400;

pub async fn mark_stale(state: &SharedLampState) {
    let peripheral = {
        let mut s = state.lock().await;
        if s.status == ConnectionStatus::Disconnected || s.user_disconnected {
            return;
        }
        s.status = ConnectionStatus::Stale;
        s.peripheral.take()
    };

    if let Some(p) = peripheral {
        disconnect_peripheral(&p).await;
    }
}

pub fn spawn_auto_reconnect(state: SharedLampState) {
    tokio::spawn(async move {
        attempt_auto_reconnect(state).await;
    });
}

async fn attempt_auto_reconnect(state: SharedLampState) {
    {
        let mut s = state.lock().await;
        if s.user_disconnected {
            return;
        }
        if s.reconnect_in_progress {
            return;
        }
        if let Some(last) = s.last_reconnect_at {
            if last.elapsed() < Duration::from_secs(COOLDOWN_SECS)
                && s.status == ConnectionStatus::Failed
                && s.reconnect_attempts >= MAX_RECONNECT_ATTEMPTS
            {
                return;
            }
        }
        s.reconnect_in_progress = true;
        s.status = ConnectionStatus::Reconnecting;
    }

    while {
        let s = state.lock().await;
        s.reconnect_attempts < MAX_RECONNECT_ATTEMPTS
    } {
        {
            let mut s = state.lock().await;
            if s.user_disconnected {
                s.reconnect_in_progress = false;
                return;
            }
        }

        let attempt = {
            let s = state.lock().await;
            s.reconnect_attempts
        };

        let delay = RECONNECT_DELAYS_MS
            .get(attempt as usize)
            .copied()
            .unwrap_or(4000);
        sleep(Duration::from_millis(delay)).await;

        let existing = {
            let mut s = state.lock().await;
            s.status = ConnectionStatus::Reconnecting;
            s.peripheral.take()
        };

        if let Some(p) = existing {
            disconnect_peripheral(&p).await;
            sleep(Duration::from_millis(TEARDOWN_DELAY_MS)).await;
        }

        let peripheral = match scan_for_lamp().await {
            Ok(p) => p,
            Err(_) => {
                let mut s = state.lock().await;
                s.reconnect_attempts += 1;
                s.last_reconnect_at = Some(Instant::now());
                continue;
            }
        };

        {
            let mut s = state.lock().await;
            s.status = ConnectionStatus::Connecting;
        }

        if connect_peripheral(&peripheral).await.is_err() {
            let mut s = state.lock().await;
            s.reconnect_attempts += 1;
            s.last_reconnect_at = Some(Instant::now());
            continue;
        }

        let mut s = state.lock().await;
        s.status = ConnectionStatus::Connected;
        s.peripheral = Some(peripheral);
        s.reconnect_in_progress = false;
        s.reconnect_attempts = 0;
        s.last_reconnect_at = None;
        return;
    }

    let mut s = state.lock().await;
    s.reconnect_in_progress = false;
    s.status = ConnectionStatus::Failed;
    s.last_reconnect_at = Some(Instant::now());
}

/// Used by lib.rs perform_connect — exposed for manual connect paths.
pub async fn perform_connect(
    state: &SharedLampState,
    mode: ConnectMode,
) -> Result<(), LampError> {
    let initial_status = match mode {
        ConnectMode::Reconnect => ConnectionStatus::Reconnecting,
        ConnectMode::Manual | ConnectMode::Refresh => ConnectionStatus::Scanning,
    };

    let existing = {
        let mut s = state.lock().await;
        s.reconnect_in_progress = true;
        s.status = initial_status.clone();
        s.peripheral.take()
    };

    if let Some(p) = existing {
        disconnect_peripheral(&p).await;
        sleep(Duration::from_millis(TEARDOWN_DELAY_MS)).await;
    }

    let peripheral = match scan_for_lamp().await {
        Ok(p) => p,
        Err(e) => {
            let mut s = state.lock().await;
            s.reconnect_in_progress = false;
            s.status = ConnectionStatus::Failed;
            s.last_reconnect_at = Some(Instant::now());
            return Err(e);
        }
    };

    {
        let mut s = state.lock().await;
        s.status = ConnectionStatus::Connecting;
    }

    if let Err(e) = connect_peripheral(&peripheral).await {
        let mut s = state.lock().await;
        s.reconnect_in_progress = false;
        s.status = ConnectionStatus::Failed;
        s.last_reconnect_at = Some(Instant::now());
        return Err(e);
    }

    let mut s = state.lock().await;
    s.status = ConnectionStatus::Connected;
    s.peripheral = Some(peripheral);
    s.reconnect_in_progress = false;
    s.reconnect_attempts = 0;
    s.user_disconnected = false;
    s.last_reconnect_at = None;
    Ok(())
}

/// Write color to the lamp if connected; marks stale and spawns reconnect on failure.
pub async fn write_color_if_connected(
    state: &SharedLampState,
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
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
            mark_stale(state).await;
            spawn_auto_reconnect(state.clone());
            return Err(LampError::ConnectionStale);
        }

        write_color(peripheral, char_uuid, r, g, b, brightness).await
    };

    match write_result {
        Ok(()) => Ok(()),
        Err(e) => {
            mark_stale(state).await;
            spawn_auto_reconnect(state.clone());
            Err(e)
        }
    }
}

use crate::errors::LampError;
use crate::lamp::write_color;
use crate::reconnect::{mark_stale, spawn_auto_reconnect};
use crate::state::{ConnectionStatus, SharedLampState};

use btleplug::api::Peripheral as _;
use btleplug::platform::Peripheral;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use uuid::Uuid;

const WRITE_TIMEOUT: Duration = Duration::from_secs(5);

static WRITE_GATE: OnceLock<Arc<Mutex<()>>> = OnceLock::new();
static WRITE_TIMEOUT_COUNT: AtomicU32 = AtomicU32::new(0);
static WRITE_GATE_BUSY_COUNT: AtomicU32 = AtomicU32::new(0);
static GLOBAL_WRITE_IN_FLIGHT: AtomicU32 = AtomicU32::new(0);

fn write_gate() -> Arc<Mutex<()>> {
    WRITE_GATE
        .get_or_init(|| Arc::new(Mutex::new(())))
        .clone()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WritePriority {
    User,
    Ambient,
    Watchdog,
}

pub fn global_write_timeout_count() -> u32 {
    WRITE_TIMEOUT_COUNT.load(Ordering::Relaxed)
}

pub fn global_write_gate_busy_count() -> u32 {
    WRITE_GATE_BUSY_COUNT.load(Ordering::Relaxed)
}

pub fn global_write_in_flight() -> u8 {
    GLOBAL_WRITE_IN_FLIGHT.load(Ordering::Relaxed).min(1) as u8
}

struct WriteContext {
    peripheral: Peripheral,
    char_uuid: Uuid,
    connect_epoch: u64,
}

async fn prepare_write(state: &SharedLampState) -> Result<WriteContext, LampError> {
    let s = state.lock().await;
    if s.status != ConnectionStatus::Connected {
        if matches!(
            s.status,
            ConnectionStatus::Stale | ConnectionStatus::Reconnecting
        ) {
            return Err(LampError::ConnectionStale);
        }
        return Err(LampError::NotConnected);
    }
    let peripheral = match s.peripheral.as_ref() {
        Some(p) => p.clone(),
        None => return Err(LampError::NotConnected),
    };
    Ok(WriteContext {
        peripheral,
        char_uuid: s.characteristic_uuid,
        connect_epoch: s.connect_epoch,
    })
}

async fn execute_ble_write(
    ctx: &WriteContext,
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
) -> Result<(), LampError> {
    if let Ok(false) = ctx.peripheral.is_connected().await {
        return Err(LampError::ConnectionStale);
    }

    tokio::time::timeout(
        WRITE_TIMEOUT,
        write_color(&ctx.peripheral, ctx.char_uuid, r, g, b, brightness),
    )
    .await
    .map_err(|_| {
        WRITE_TIMEOUT_COUNT.fetch_add(1, Ordering::Relaxed);
        LampError::WriteFailure
    })?
}

async fn commit_write_success(
    state: &SharedLampState,
    ctx: &WriteContext,
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
) {
    let mut s = state.lock().await;
    if s.connect_epoch != ctx.connect_epoch || s.status != ConnectionStatus::Connected {
        return;
    }
    s.last_color = Some((r, g, b, brightness));
    s.last_write_at = Some(Instant::now());
}

/// Serialized BLE write used by Ambient, presets, loops, manual control, and watchdog.
pub async fn write_color_if_connected(
    state: &SharedLampState,
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
    priority: WritePriority,
) -> Result<(), LampError> {
    if brightness > 64 {
        return Err(LampError::InvalidValue(format!(
            "brightness must be 0–64, got {brightness}"
        )));
    }

    let gate = write_gate();
    let _guard = match priority {
        WritePriority::User => tokio::time::timeout(WRITE_TIMEOUT, gate.lock())
            .await
            .map_err(|_| {
                WRITE_TIMEOUT_COUNT.fetch_add(1, Ordering::Relaxed);
                LampError::WriteFailure
            })?,
        WritePriority::Ambient | WritePriority::Watchdog => gate.try_lock().map_err(|_| {
            WRITE_GATE_BUSY_COUNT.fetch_add(1, Ordering::Relaxed);
            LampError::WriteBusy
        })?,
    };

    GLOBAL_WRITE_IN_FLIGHT.store(1, Ordering::Relaxed);

    let result = async {
        let ctx = prepare_write(state).await?;
        execute_ble_write(&ctx, r, g, b, brightness).await?;
        commit_write_success(state, &ctx, r, g, b, brightness).await;
        Ok(())
    }
    .await;

    GLOBAL_WRITE_IN_FLIGHT.store(0, Ordering::Relaxed);

    if let Err(e) = &result {
        if !matches!(e, LampError::WriteBusy) {
            mark_stale(state).await;
            spawn_auto_reconnect(state.clone());
        }
    }

    result
}

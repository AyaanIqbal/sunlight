use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter, WriteType};
use btleplug::platform::{Manager, Peripheral};
use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;

use crate::errors::LampError;
use crate::protocol::make_color_packet;

const TARGET_DEVICE_NAME: &str = "SSL-99A4C3";
const SCAN_DURATION_SECS: u64 = 8;

/// Scan for the lamp and return the first matching peripheral.
pub async fn scan_for_lamp() -> Result<Peripheral, LampError> {
    let manager = Manager::new()
        .await
        .map_err(|_| LampError::BluetoothUnavailable)?;

    let adapters = manager
        .adapters()
        .await
        .map_err(|_| LampError::BluetoothUnavailable)?;

    let adapter = adapters.into_iter().next().ok_or(LampError::BluetoothUnavailable)?;

    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|_| LampError::BluetoothUnavailable)?;

    sleep(Duration::from_secs(SCAN_DURATION_SECS)).await;

    adapter
        .stop_scan()
        .await
        .ok();

    let peripherals = adapter
        .peripherals()
        .await
        .map_err(|_| LampError::BluetoothUnavailable)?;

    for p in peripherals {
        if let Ok(Some(props)) = p.properties().await {
            if props
                .local_name
                .as_deref()
                .map(|n| n == TARGET_DEVICE_NAME)
                .unwrap_or(false)
            {
                return Ok(p);
            }
        }
    }

    Err(LampError::DeviceNotFound)
}

/// Best-effort disconnect; ignores errors (device may already be gone or out of range).
pub async fn disconnect_peripheral(peripheral: &Peripheral) {
    if let Ok(true) = peripheral.is_connected().await {
        let _ = peripheral.disconnect().await;
    }
}

/// Connect and discover services/characteristics on the peripheral.
pub async fn connect_peripheral(peripheral: &Peripheral) -> Result<(), LampError> {
    peripheral
        .connect()
        .await
        .map_err(|_| LampError::DeviceUnavailable)?;

    peripheral
        .discover_services()
        .await
        .map_err(|_| LampError::DeviceUnavailable)?;

    Ok(())
}

/// Write an encrypted RGB + brightness command to the lamp.
pub async fn write_color(
    peripheral: &Peripheral,
    characteristic_uuid: Uuid,
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
) -> Result<(), LampError> {
    let chars = peripheral.characteristics();
    let characteristic = chars
        .iter()
        .find(|c| c.uuid == characteristic_uuid)
        .ok_or(LampError::WriteFailure)?;

    let packet = make_color_packet(r, g, b, brightness);

    peripheral
        .write(characteristic, &packet, WriteType::WithoutResponse)
        .await
        .map_err(|_| LampError::WriteFailure)?;

    Ok(())
}

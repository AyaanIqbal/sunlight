use btleplug::platform::Peripheral;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Disconnected,
    Scanning,
    Connecting,
    Connected,
    Reconnecting,
    Stale,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectMode {
    Manual,
    Refresh,
    Reconnect,
}

pub struct LampState {
    pub status: ConnectionStatus,
    pub peripheral: Option<Peripheral>,
    pub characteristic_uuid: uuid::Uuid,
    pub reconnect_in_progress: bool,
    pub reconnect_attempts: u8,
    pub last_reconnect_at: Option<Instant>,
    pub user_disconnected: bool,
}

impl LampState {
    pub fn new() -> Self {
        Self {
            status: ConnectionStatus::Disconnected,
            peripheral: None,
            characteristic_uuid: uuid::Uuid::parse_str("0000ac52-1212-efde-1523-785fedbeda25")
                .expect("valid UUID"),
            reconnect_in_progress: false,
            reconnect_attempts: 0,
            last_reconnect_at: None,
            user_disconnected: false,
        }
    }
}

pub type SharedLampState = Arc<Mutex<LampState>>;

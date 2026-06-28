use btleplug::platform::Peripheral;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Disconnected,
    Scanning,
    Connecting,
    Connected,
    Failed,
}

pub struct LampState {
    pub status: ConnectionStatus,
    pub peripheral: Option<Peripheral>,
    pub characteristic_uuid: uuid::Uuid,
}

impl LampState {
    pub fn new() -> Self {
        Self {
            status: ConnectionStatus::Disconnected,
            peripheral: None,
            characteristic_uuid: uuid::Uuid::parse_str("0000ac52-1212-efde-1523-785fedbeda25")
                .expect("valid UUID"),
        }
    }
}

pub type SharedLampState = Mutex<LampState>;

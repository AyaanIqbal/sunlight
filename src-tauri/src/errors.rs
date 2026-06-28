use thiserror::Error;

#[derive(Debug, Error)]
pub enum LampError {
    #[error("Bluetooth is not available or turned off. Enable Bluetooth and try again.")]
    BluetoothUnavailable,

    #[error("Could not find SSL-99A4C3. Make sure the lamp is on and the iStrip app is closed.")]
    DeviceNotFound,

    #[error("Connection failed. Close the iStrip app and try again.")]
    ConnectionFailed,

    #[error("Not connected to a lamp. Connect first.")]
    NotConnected,

    #[error("Failed to send color. The lamp may have disconnected.")]
    WriteFailure,

    #[error("Invalid value: {0}")]
    InvalidValue(String),

    #[error("{0}")]
    Other(String),
}

impl From<btleplug::Error> for LampError {
    fn from(e: btleplug::Error) -> Self {
        match e {
            btleplug::Error::NotConnected => LampError::NotConnected,
            btleplug::Error::PermissionDenied => {
                LampError::Other("Bluetooth permission is required to control the lamp.".to_string())
            }
            other => LampError::Other(other.to_string()),
        }
    }
}

// Allow serializing the error message for Tauri commands
impl serde::Serialize for LampError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

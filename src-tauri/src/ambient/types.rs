use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSettings {
    pub quality: String,
    pub output_fps: u8,
    pub edge_priority: String,
    pub saturation_boost: f32,
    pub brightness_boost: f32,
    pub responsiveness: f32,
    pub min_color_delta: u8,
    pub debug: bool,
    pub brightness_mode: String,
    pub brightness_response: String,
    pub brightness_response_fine_tune: f32,
    pub black_threshold: f32,
    pub min_active_brightness: u8,
    pub max_brightness: u8,
    pub brightness_smoothing: f32,
    pub center_contribution: f32,
    pub highlight_influence: f32,
}

impl Default for AmbientSettings {
    fn default() -> Self {
        Self {
            quality: "balanced".to_string(),
            output_fps: 8,
            edge_priority: "high".to_string(),
            saturation_boost: 1.4,
            brightness_boost: 1.15,
            responsiveness: 0.5,
            min_color_delta: 10,
            debug: false,
            brightness_mode: "dynamic".to_string(),
            brightness_response: "dimmer".to_string(),
            brightness_response_fine_tune: 0.5,
            black_threshold: 0.06,
            min_active_brightness: 4,
            max_brightness: 64,
            brightness_smoothing: 0.22,
            center_contribution: 0.15,
            highlight_influence: 0.30,
        }
    }
}

impl AmbientSettings {
    pub fn dimensions(&self) -> (u32, u32) {
        match self.quality.as_str() {
            "performance" => (96, 54),
            "responsive_detail" => (160, 90),
            _ => (128, 72),
        }
    }

    pub fn edge_band_fraction(&self) -> f32 {
        match self.edge_priority.as_str() {
            "low" => 0.15,
            "medium" => 0.18,
            _ => 0.20,
        }
    }

    pub fn edge_weight_scale(&self) -> f32 {
        match self.edge_priority.as_str() {
            "low" => 0.7,
            "medium" => 1.0,
            _ => 1.2,
        }
    }

    pub fn output_interval_ms(&self) -> u64 {
        let fps = match self.output_fps {
            4 => 4,
            10 => 10,
            12 => 12,
            15 => 15,
            _ => 8,
        };
        1000 / fps as u64
    }

    pub fn is_dynamic_brightness(&self) -> bool {
        self.brightness_mode != "manual"
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AmbientStatus {
    Inactive,
    CheckingPermission,
    WaitingForPermission,
    StartingCapture,
    Running,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientFrameEvent {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub hex: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub computed_brightness: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_brightness: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smoothed_brightness: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spatial_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlight_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screen_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brightness_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub black_threshold: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_contribution: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlight_influence: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_fps: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_fps: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processing_ms: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped_sends: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AmbientStopReason {
    User,
    ManualColor,
    Preset,
    Loop,
    Disconnect,
    ConnectionLost,
    Import,
    Reset,
    Permission,
    CaptureFailed,
    Performance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientStoppedEvent {
    pub reason: AmbientStopReason,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScreenCapturePermission {
    Granted,
    Denied,
    Unknown,
}

pub fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

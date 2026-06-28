use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AmbientOutputRate {
    Fixed(u8),
    AdaptiveMax,
}

impl Default for AmbientOutputRate {
    fn default() -> Self {
        Self::Fixed(8)
    }
}

impl Serialize for AmbientOutputRate {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Fixed(fps) => serializer.serialize_u8(*fps),
            Self::AdaptiveMax => serializer.serialize_str("adaptive_max"),
        }
    }
}

impl<'de> Deserialize<'de> for AmbientOutputRate {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        Ok(normalize_output_rate_value(value))
    }
}

fn normalize_output_rate_value(value: serde_json::Value) -> AmbientOutputRate {
    match value {
        serde_json::Value::Number(n) => n
            .as_u64()
            .and_then(|v| u8::try_from(v).ok())
            .map(AmbientOutputRate::Fixed)
            .unwrap_or_default(),
        serde_json::Value::String(s) if s == "adaptive_max" => AmbientOutputRate::AdaptiveMax,
        _ => AmbientOutputRate::default(),
    }
}

impl AmbientOutputRate {
    pub fn is_adaptive_max(&self) -> bool {
        matches!(self, Self::AdaptiveMax)
    }

    pub fn as_fixed_fps(&self) -> Option<u8> {
        match self {
            Self::Fixed(fps) => Some(*fps),
            Self::AdaptiveMax => None,
        }
    }
}

pub fn fps_to_interval_ms(fps: u8) -> u64 {
    1000 / fps.max(1) as u64
}

pub fn fixed_target_sample_interval_ms(fps: u8) -> u64 {
    match fps {
        20 => 40,
        25 => 33,
        30 => 30,
        _ => 55,
    }
}

pub fn fixed_output_fps(fps: u8) -> u8 {
    match fps {
        4 | 8 | 10 | 12 | 15 | 20 | 25 | 30 => fps,
        _ => 8,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSettings {
    pub quality: String,
    #[serde(default, deserialize_with = "deserialize_output_rate_field")]
    pub output_fps: AmbientOutputRate,
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

fn deserialize_output_rate_field<'de, D>(deserializer: D) -> Result<AmbientOutputRate, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(v) => normalize_output_rate_value(v),
        None => AmbientOutputRate::default(),
    })
}

impl Default for AmbientSettings {
    fn default() -> Self {
        Self {
            quality: "balanced".to_string(),
            output_fps: AmbientOutputRate::default(),
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

    pub fn is_adaptive_max(&self) -> bool {
        self.output_fps.is_adaptive_max()
    }

    pub fn output_interval_ms(&self) -> u64 {
        let fps = fixed_output_fps(self.output_fps.as_fixed_fps().unwrap_or(8));
        fps_to_interval_ms(fps)
    }

    pub fn target_sample_interval_ms(&self) -> u64 {
        let fps = fixed_output_fps(self.output_fps.as_fixed_fps().unwrap_or(8));
        fixed_target_sample_interval_ms(fps)
    }

    pub fn target_capture_fps(&self) -> f32 {
        1000.0 / self.target_sample_interval_ms() as f32
    }

    pub fn target_output_fps(&self) -> f32 {
        fixed_output_fps(self.output_fps.as_fixed_fps().unwrap_or(8)) as f32
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
    pub screen_intensity: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientDebugMetrics {
    pub capture_fps: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_capture_fps: Option<f32>,
    pub capture_time_ms_avg: f32,
    pub capture_time_ms_last: f32,
    pub capture_failures: u32,
    pub processing_time_ms_avg: f32,
    pub processing_time_ms_last: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downsample_time_ms_avg: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub algorithm_time_ms_avg: Option<f32>,
    pub target_output_fps: f32,
    pub actual_output_fps: f32,
    pub output_interval_ms_avg: f32,
    pub time_since_last_frame_ms: f32,
    pub time_since_last_ble_send_ms: f32,
    pub ble_write_time_ms_avg: f32,
    pub ble_write_time_ms_last: f32,
    pub ble_write_failures: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ble_writes_in_flight: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ble_busy_skips: Option<u32>,
    pub skipped_due_to_delta: u32,
    pub skipped_due_to_rate_limit: u32,
    pub skipped_due_to_duplicate: u32,
    pub skipped_due_to_stale_connection: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dropped_frames: Option<u32>,
    pub color_delta_last: u32,
    pub brightness_delta_last: u32,
    pub computed_brightness: u8,
    pub screen_intensity: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spatial_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlight_intensity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smoothed_brightness: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_brightness: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brightness_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub black_threshold: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_contribution: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlight_influence: Option<f32>,
    pub adaptive_mode_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_target_fps: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_capture_target_fps: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_output_target_fps: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_last_adjustment_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_frame_budget_ms: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptive_stability_score: Option<f32>,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub consecutive_capture_failures: u32,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub capture_timeouts: u32,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub stale_capture_discarded: u32,
    #[serde(default, skip_serializing_if = "is_false")]
    pub capture_in_flight: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub capture_backoff_active: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_ambient_stop_reason: Option<String>,
    #[serde(default, skip_serializing_if = "is_zero_u8")]
    pub global_ble_write_in_flight: u8,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub global_ble_write_timeout_count: u32,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub global_ble_write_gate_busy_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adaptive_recent_ble_failure_delta: Option<u32>,
}

fn is_zero_u32(v: &u32) -> bool {
    *v == 0
}

fn is_zero_u8(v: &u8) -> bool {
    *v == 0
}

fn is_false(v: &bool) -> bool {
    !*v
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

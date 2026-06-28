use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn default_transition_enabled() -> bool {
    true
}

fn default_transition_duration_ms() -> u32 {
    1200
}

fn default_loops() -> Vec<LampLoop> {
    vec![]
}

fn default_loop_sections() -> Vec<LoopSection> {
    vec![]
}

fn default_ambient_settings() -> AmbientSettings {
    AmbientSettings::default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSettings {
    #[serde(default = "default_ambient_quality")]
    pub quality: String,
    #[serde(default = "default_ambient_output_fps")]
    pub output_fps: u8,
    #[serde(default = "default_ambient_edge_priority")]
    pub edge_priority: String,
    #[serde(default = "default_ambient_saturation_boost")]
    pub saturation_boost: f32,
    #[serde(default = "default_ambient_brightness_boost")]
    pub brightness_boost: f32,
    #[serde(default = "default_ambient_responsiveness")]
    pub responsiveness: f32,
    #[serde(default = "default_ambient_min_color_delta")]
    pub min_color_delta: u8,
    #[serde(default)]
    pub debug: bool,
    #[serde(default = "default_brightness_mode")]
    pub brightness_mode: String,
    #[serde(default = "default_brightness_response")]
    pub brightness_response: String,
    #[serde(default = "default_brightness_response_fine_tune")]
    pub brightness_response_fine_tune: f32,
    #[serde(default = "default_black_threshold")]
    pub black_threshold: f32,
    #[serde(default = "default_min_active_brightness")]
    pub min_active_brightness: u8,
    #[serde(default = "default_max_brightness")]
    pub max_brightness: u8,
    #[serde(default = "default_brightness_smoothing")]
    pub brightness_smoothing: f32,
    #[serde(default = "default_center_contribution")]
    pub center_contribution: f32,
    #[serde(default = "default_highlight_influence")]
    pub highlight_influence: f32,
}

fn default_ambient_quality() -> String {
    "balanced".to_string()
}

fn default_ambient_output_fps() -> u8 {
    8
}

fn default_ambient_edge_priority() -> String {
    "high".to_string()
}

fn default_ambient_saturation_boost() -> f32 {
    1.4
}

fn default_ambient_brightness_boost() -> f32 {
    1.15
}

fn default_ambient_responsiveness() -> f32 {
    0.5
}

fn default_ambient_min_color_delta() -> u8 {
    10
}

fn default_brightness_mode() -> String {
    "dynamic".to_string()
}

fn default_brightness_response() -> String {
    "dimmer".to_string()
}

fn default_brightness_response_fine_tune() -> f32 {
    0.5
}

fn default_black_threshold() -> f32 {
    0.06
}

fn default_min_active_brightness() -> u8 {
    4
}

fn default_max_brightness() -> u8 {
    64
}

fn default_brightness_smoothing() -> f32 {
    0.22
}

fn default_center_contribution() -> f32 {
    0.15
}

fn default_highlight_influence() -> f32 {
    0.30
}

impl Default for AmbientSettings {
    fn default() -> Self {
        Self {
            quality: default_ambient_quality(),
            output_fps: default_ambient_output_fps(),
            edge_priority: default_ambient_edge_priority(),
            saturation_boost: default_ambient_saturation_boost(),
            brightness_boost: default_ambient_brightness_boost(),
            responsiveness: default_ambient_responsiveness(),
            min_color_delta: default_ambient_min_color_delta(),
            debug: false,
            brightness_mode: default_brightness_mode(),
            brightness_response: default_brightness_response(),
            brightness_response_fine_tune: default_brightness_response_fine_tune(),
            black_threshold: default_black_threshold(),
            min_active_brightness: default_min_active_brightness(),
            max_brightness: default_max_brightness(),
            brightness_smoothing: default_brightness_smoothing(),
            center_contribution: default_center_contribution(),
            highlight_influence: default_highlight_influence(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(rename = "deviceName")]
    pub device_name: String,
    #[serde(rename = "autoConnect")]
    pub auto_connect: bool,
    #[serde(rename = "liveUpdate")]
    pub live_update: bool,
    #[serde(rename = "transitionEnabled", default = "default_transition_enabled")]
    pub transition_enabled: bool,
    #[serde(rename = "transitionDurationMs", default = "default_transition_duration_ms")]
    pub transition_duration_ms: u32,
    #[serde(rename = "activeWorkspace", default)]
    pub active_workspace: Option<String>,
    #[serde(default = "default_ambient_settings")]
    pub ambient: AmbientSettings,
    #[serde(rename = "lastColor")]
    pub last_color: LastColor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub brightness: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LampPreset {
    pub id: String,
    pub name: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub brightness: u8,
    pub gradient: Option<GradientColors>,
    pub notes: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GradientColors {
    #[serde(rename = "borderColor")]
    pub border_color: String,
    #[serde(rename = "mainColor")]
    pub main_color: String,
    #[serde(rename = "middleColor")]
    pub middle_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetSection {
    pub id: String,
    pub name: String,
    pub collapsed: bool,
    #[serde(rename = "presetIds")]
    pub preset_ids: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopStep {
    pub id: String,
    pub name: Option<String>,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub brightness: u8,
    pub hold_ms: u32,
    pub transition_to_next_ms: u32,
    pub transition_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LampLoop {
    pub id: String,
    pub name: String,
    pub steps: Vec<LoopStep>,
    pub notes: Option<String>,
    #[serde(rename = "sectionId")]
    pub section_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopSection {
    pub id: String,
    pub name: String,
    pub collapsed: bool,
    #[serde(rename = "loopIds")]
    pub loop_ids: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    #[serde(rename = "schemaVersion", default)]
    pub schema_version: u32,
    pub settings: AppSettings,
    pub sections: Vec<PresetSection>,
    pub presets: Vec<LampPreset>,
    #[serde(rename = "loopSections", default = "default_loop_sections")]
    pub loop_sections: Vec<LoopSection>,
    #[serde(default = "default_loops")]
    pub loops: Vec<LampLoop>,
}

fn state_file_path(app: &AppHandle) -> PathBuf {
    let data_dir = app.path().app_data_dir().expect("app data dir");
    std::fs::create_dir_all(&data_dir).ok();
    data_dir.join("state.json")
}

pub fn load(app: &AppHandle) -> Option<AppState> {
    let path = state_file_path(app);
    let contents = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&contents).ok()
}

pub fn save(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let path = state_file_path(app);
    let contents = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

mod adaptive;
mod brightness;
mod capture;
mod color;
mod engine;
mod metrics;
mod permission;
mod types;

pub use engine::{stop_ambient_engine, AmbientEngine, SharedAmbientEngine};
pub use permission::{check_screen_capture_permission, request_screen_capture_permission};
pub use types::{
    AmbientSettings, AmbientStatus, AmbientStopReason, ScreenCapturePermission,
};

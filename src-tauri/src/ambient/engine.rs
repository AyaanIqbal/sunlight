use super::capture::CaptureSession;
use super::color::{downgrade_quality, ColorProcessor};
use super::permission::{
    check_screen_capture_permission, request_screen_capture_permission,
    screen_capture_denied_message,
};
use super::types::{
    rgb_to_hex, AmbientFrameEvent, AmbientSettings, AmbientStatus, AmbientStopReason,
    AmbientStoppedEvent, ScreenCapturePermission,
};
use crate::errors::LampError;
use crate::reconnect::write_color_if_connected;
use crate::state::{ConnectionStatus, SharedLampState};

use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::{watch, Mutex, RwLock};
use tokio::task::JoinHandle;

#[derive(Clone)]
struct RuntimeConfig {
    settings: AmbientSettings,
    brightness: u8,
}

pub struct AmbientEngine {
    pub(crate) status: AmbientStatus,
    config: Arc<RwLock<RuntimeConfig>>,
    stop_tx: Option<watch::Sender<bool>>,
    task: Option<JoinHandle<()>>,
    quality_downgraded: bool,
}

impl Default for AmbientEngine {
    fn default() -> Self {
        Self {
            status: AmbientStatus::Inactive,
            config: Arc::new(RwLock::new(RuntimeConfig {
                settings: AmbientSettings::default(),
                brightness: 64,
            })),
            stop_tx: None,
            task: None,
            quality_downgraded: false,
        }
    }
}

pub type SharedAmbientEngine = Arc<Mutex<AmbientEngine>>;

impl AmbientEngine {
    pub fn status(&self) -> AmbientStatus {
        if matches!(
            self.status,
            AmbientStatus::StartingCapture | AmbientStatus::Running
        ) && self.task.as_ref().is_some_and(|t| t.is_finished())
        {
            return AmbientStatus::Stopped;
        }
        self.status
    }

    pub async fn start(
        &mut self,
        app: AppHandle,
        lamp_state: SharedLampState,
        settings: AmbientSettings,
        brightness: u8,
    ) -> Result<(), String> {
        if self.status == AmbientStatus::Running
            || self.status == AmbientStatus::StartingCapture
            || self.status == AmbientStatus::CheckingPermission
        {
            if self.task.as_ref().is_none_or(|t| !t.is_finished()) {
                return Ok(());
            }
            self.task = None;
            self.status = AmbientStatus::Stopped;
        }

        {
            let s = lamp_state.lock().await;
            if s.status != ConnectionStatus::Connected {
                return Err("Connect to SSL-99A4C3 before starting Ambient Mode.".to_string());
            }
        }

        self.stop_internal().await;
        self.quality_downgraded = false;
        self.status = AmbientStatus::CheckingPermission;
        emit_status(&app, self.status);

        let permission = check_screen_capture_permission();
        if permission != ScreenCapturePermission::Granted {
            self.status = AmbientStatus::WaitingForPermission;
            emit_status(&app, self.status);
            let requested = request_screen_capture_permission();
            if requested != ScreenCapturePermission::Granted {
                self.status = AmbientStatus::Failed;
                emit_status(&app, self.status);
                return Err(screen_capture_denied_message());
            }
        }

        {
            let mut cfg = self.config.write().await;
            cfg.settings = settings;
            cfg.brightness = brightness;
        }

        self.status = AmbientStatus::StartingCapture;
        emit_status(&app, self.status);

        let (stop_tx, stop_rx) = watch::channel(false);
        self.stop_tx = Some(stop_tx);
        let config = self.config.clone();

        let handle = tokio::spawn(async move {
            run_ambient_loop(app, lamp_state, config, stop_rx).await;
        });
        self.task = Some(handle);
        self.status = AmbientStatus::Running;
        Ok(())
    }

    pub async fn stop(&mut self, app: Option<&AppHandle>, reason: AmbientStopReason, message: Option<String>) {
        self.stop_internal().await;
        self.status = AmbientStatus::Stopped;
        if let Some(app) = app {
            emit_status(app, self.status);
            let _ = app.emit(
                "ambient://stopped",
                AmbientStoppedEvent { reason, message },
            );
        }
    }

    async fn stop_internal(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(true);
        }
        if let Some(task) = self.task.take() {
            let mut task = task;
            tokio::select! {
                _ = &mut task => {}
                _ = tokio::time::sleep(Duration::from_millis(1500)) => {
                    task.abort();
                }
            }
            let _ = task.await;
        }
    }

    pub async fn update_settings(&self, settings: AmbientSettings, brightness: Option<u8>) {
        let mut cfg = self.config.write().await;
        cfg.settings = settings;
        if let Some(b) = brightness {
            cfg.brightness = b;
        }
    }
}

async fn run_ambient_loop(
    app: AppHandle,
    lamp_state: SharedLampState,
    config: Arc<RwLock<RuntimeConfig>>,
    mut stop_rx: watch::Receiver<bool>,
) {
    let initial = config.read().await.clone();
    let (width, height) = initial.settings.dimensions();

    let mut capture = match CaptureSession::start(width, height).await {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit(
                "ambient://stopped",
                AmbientStoppedEvent {
                    reason: AmbientStopReason::CaptureFailed,
                    message: Some(if e.contains("permission") {
                        e
                    } else {
                        "Could not capture the screen. Check Screen Recording permission and try again.".to_string()
                    }),
                },
            );
            let _ = app.emit("ambient://status", serde_json::json!({ "status": "failed" }));
            return;
        }
    };

    let _ = app.emit("ambient://status", serde_json::json!({ "status": "running" }));

    let mut processor = ColorProcessor::default();
    let mut last_ble_send = Instant::now() - Duration::from_secs(1);
    let mut skipped_sends: u32 = 0;
    let mut sample_times: Vec<Instant> = Vec::with_capacity(30);
    let mut ble_times: Vec<Instant> = Vec::with_capacity(10);
    let mut processing_samples: Vec<f32> = Vec::with_capacity(30);
    let mut quality_downgraded = false;
    let mut needs_capture_restart = false;
    let mut current_dims = (width, height);

    loop {
        if *stop_rx.borrow() {
            break;
        }

        let frame = tokio::select! {
            biased;
            _ = stop_rx.changed() => {
                if *stop_rx.borrow() { break; }
                continue;
            }
            frame = tokio::time::timeout(Duration::from_secs(3), capture.next_frame()) => {
                match frame {
                    Ok(frame) => frame,
                    Err(_) => None,
                }
            }
        };

        let Some(frame) = frame else {
            if let Some(err) = capture_error_hint() {
                let _ = app.emit(
                    "ambient://stopped",
                    AmbientStoppedEvent {
                        reason: AmbientStopReason::CaptureFailed,
                        message: Some(err),
                    },
                );
                break;
            }
            continue;
        };

        let frame_start = Instant::now();
        let runtime = config.read().await.clone();
        let settings = &runtime.settings;

        if needs_capture_restart {
            let (w, h) = settings.dimensions();
            current_dims = (w, h);
            capture.width = w;
            capture.height = h;
            processor.reset();
            needs_capture_restart = false;
        } else if settings.dimensions() != current_dims {
            needs_capture_restart = true;
            continue;
        }

        // Target ~18 FPS sample rate for polling capture backends.
        let sample_interval = Duration::from_millis(55);
        let elapsed_since_start = frame_start.elapsed();
        if elapsed_since_start < sample_interval {
            tokio::time::sleep(sample_interval - elapsed_since_start).await;
            if *stop_rx.borrow() {
                break;
            }
        }

        let processed = processor.process_frame(
            &frame.pixels,
            frame.width,
            frame.height,
            frame.bytes_per_row,
            settings,
            runtime.brightness,
        );

        let processing_ms = frame_start.elapsed().as_secs_f32() * 1000.0;
        processing_samples.push(processing_ms);
        if processing_samples.len() > 30 {
            processing_samples.remove(0);
        }

        if !quality_downgraded && processing_samples.len() >= 30 {
            let avg: f32 =
                processing_samples.iter().sum::<f32>() / processing_samples.len() as f32;
            if avg > 33.0 {
                let mut cfg = config.write().await;
                if downgrade_quality(&mut cfg.settings) {
                    quality_downgraded = true;
                    needs_capture_restart = true;
                    let _ = app.emit(
                        "ambient://notice",
                        serde_json::json!({
                            "message": "Ambient Mode lowered capture quality to reduce CPU usage."
                        }),
                    );
                    continue;
                }
            }
        }

        sample_times.push(Instant::now());
        if sample_times.len() > 30 {
            sample_times.remove(0);
        }

        let sample_fps = compute_fps(&sample_times);
        let output_interval = Duration::from_millis(settings.output_interval_ms());

        if last_ble_send.elapsed() >= output_interval
            && processor.should_send(&processed, settings)
        {
            let r = processed.rgb.r.clamp(0.0, 255.0) as u8;
            let g = processed.rgb.g.clamp(0.0, 255.0) as u8;
            let b = processed.rgb.b.clamp(0.0, 255.0) as u8;
            let brightness = processed.brightness;

            match write_color_if_connected(&lamp_state, r, g, b, brightness).await {
                Ok(()) => {
                    processor.mark_sent(&processed);
                    last_ble_send = Instant::now();
                    ble_times.push(Instant::now());
                    if ble_times.len() > 10 {
                        ble_times.remove(0);
                    }
                }
                Err(LampError::ConnectionStale | LampError::NotConnected | LampError::WriteFailure) => {
                    let _ = app.emit(
                        "ambient://stopped",
                        AmbientStoppedEvent {
                            reason: AmbientStopReason::ConnectionLost,
                            message: Some(
                                "Ambient Mode stopped because the lamp connection became stale."
                                    .to_string(),
                            ),
                        },
                    );
                    break;
                }
                Err(_) => {
                    let _ = app.emit(
                        "ambient://stopped",
                        AmbientStoppedEvent {
                            reason: AmbientStopReason::ConnectionLost,
                            message: Some(
                                "Ambient Mode stopped because the lamp connection became stale."
                                    .to_string(),
                            ),
                        },
                    );
                    break;
                }
            }
        } else if last_ble_send.elapsed() >= output_interval {
            skipped_sends += 1;
        }

        let output_fps = compute_fps(&ble_times);
        let r = processed.rgb.r.clamp(0.0, 255.0) as u8;
        let g = processed.rgb.g.clamp(0.0, 255.0) as u8;
        let b = processed.rgb.b.clamp(0.0, 255.0) as u8;

        let event = AmbientFrameEvent {
            r,
            g,
            b,
            hex: rgb_to_hex(r, g, b),
            computed_brightness: Some(processed.brightness),
            target_brightness: Some(processed.target_brightness),
            smoothed_brightness: Some(processed.metrics.smoothed_brightness),
            edge_intensity: Some(processed.metrics.edge_intensity),
            center_intensity: Some(processed.metrics.center_intensity),
            spatial_intensity: Some(processed.metrics.spatial_intensity),
            highlight_intensity: Some(processed.metrics.highlight_intensity),
            screen_intensity: Some(processed.screen_intensity),
            brightness_mode: Some(settings.brightness_mode.clone()),
            black_threshold: Some(settings.black_threshold),
            center_contribution: Some(settings.center_contribution),
            highlight_influence: Some(settings.highlight_influence),
            sample_fps: Some(sample_fps),
            output_fps: Some(output_fps),
            processing_ms: Some(processing_ms),
            skipped_sends: if settings.debug {
                Some(skipped_sends)
            } else {
                None
            },
        };

        let _ = app.emit("ambient://frame", event);
    }

    capture.stop().await;
    let _ = app.emit("ambient://status", serde_json::json!({ "status": "stopped" }));
}

fn compute_fps(times: &[Instant]) -> f32 {
    if times.len() < 2 {
        return 0.0;
    }
    let duration = times.last().unwrap().duration_since(times[0]);
    if duration.is_zero() {
        return 0.0;
    }
    (times.len() - 1) as f32 / duration.as_secs_f32()
}

fn emit_status(app: &AppHandle, status: AmbientStatus) {
    let _ = app.emit(
        "ambient://status",
        serde_json::json!({ "status": status }),
    );
}

fn capture_error_hint() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        if check_screen_capture_permission() != super::types::ScreenCapturePermission::Granted {
            return Some(screen_capture_denied_message());
        }
        None
    }
    #[cfg(not(target_os = "macos"))]
    {
        Some("Ambient Mode requires macOS.".to_string())
    }
}

pub async fn stop_ambient_engine(
    engine: &SharedAmbientEngine,
    app: Option<&AppHandle>,
    reason: AmbientStopReason,
    message: Option<String>,
) {
    let mut eng = engine.lock().await;
    eng.stop(app, reason, message).await;
    eng.status = AmbientStatus::Stopped;
}

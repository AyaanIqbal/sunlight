use super::capture::CaptureSession;
use super::color::{downgrade_quality, ColorProcessor, ProcessedFrame};
use super::metrics::AmbientMetricsCollector;
use super::permission::{
    check_screen_capture_permission, request_screen_capture_permission,
    screen_capture_denied_message,
};
use super::types::{
    rgb_to_hex, AmbientDebugMetrics, AmbientFrameEvent, AmbientSettings, AmbientStatus,
    AmbientStopReason, AmbientStoppedEvent, ScreenCapturePermission,
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

#[derive(Clone, Copy)]
struct PendingSend {
    r: u8,
    g: u8,
    b: u8,
    brightness: u8,
    frame: ProcessedFrame,
}

type BleWriteHandle = JoinHandle<(Result<(), LampError>, f32, ProcessedFrame)>;

struct AmbientBleOutput {
    in_flight: Option<BleWriteHandle>,
    pending: Option<PendingSend>,
    last_ble_send: Instant,
}

impl AmbientBleOutput {
    fn new() -> Self {
        Self {
            in_flight: None,
            pending: None,
            last_ble_send: Instant::now() - Duration::from_secs(1),
        }
    }

    fn is_busy(&self) -> bool {
        self.in_flight
            .as_ref()
            .is_some_and(|h| !h.is_finished())
    }
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
    let mut ble_output = AmbientBleOutput::new();
    let mut metrics = AmbientMetricsCollector::default();
    let mut processing_samples: Vec<f32> = Vec::with_capacity(30);
    let mut quality_downgraded = false;
    let mut needs_capture_restart = false;
    let mut current_dims = (width, height);
    let mut last_debug_emit = Instant::now() - Duration::from_secs(1);
    let mut last_output_fps = 0u8;

    loop {
        if *stop_rx.borrow() {
            break;
        }

        if !poll_ble_write(&mut ble_output, &mut processor, &mut metrics, &lamp_state, &app).await
        {
            break;
        }

        metrics.set_ble_writes_in_flight(if ble_output.is_busy() { 1 } else { 0 });

        let capture_start = Instant::now();
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
            metrics.record_capture_failure();
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

        metrics.record_capture(frame.capture_ms, frame.downsample_ms);

        let runtime = config.read().await.clone();
        let settings = &runtime.settings;

        if settings.output_fps != last_output_fps {
            metrics.reset_sustain_notice();
            last_output_fps = settings.output_fps;
        }

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

        let process_start = Instant::now();
        let (processed, algorithm_ms) = processor.process_frame_timed(
            &frame.pixels,
            frame.width,
            frame.height,
            frame.bytes_per_row,
            settings,
            runtime.brightness,
        );
        let processing_ms = process_start.elapsed().as_secs_f32() * 1000.0;
        metrics.record_processing(processing_ms, algorithm_ms);

        let (color_delta, brightness_delta) = processor.compute_deltas(&processed);
        metrics.set_output_deltas(color_delta, brightness_delta);
        metrics.set_output_state(processed.brightness, processed.screen_intensity);

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

        let output_interval = Duration::from_millis(settings.output_interval_ms());
        let r = processed.rgb.r.clamp(0.0, 255.0) as u8;
        let g = processed.rgb.g.clamp(0.0, 255.0) as u8;
        let b = processed.rgb.b.clamp(0.0, 255.0) as u8;
        let brightness = processed.brightness;
        let send = PendingSend {
            r,
            g,
            b,
            brightness,
            frame: processed,
        };

        if ble_output.last_ble_send.elapsed() >= output_interval {
            if processor.is_duplicate(&processed) {
                metrics.record_skip_duplicate();
            } else if processor.should_send(&processed, settings) {
                if ble_output.is_busy() {
                    metrics.record_ble_busy_skip();
                    if ble_output.pending.is_some() {
                        metrics.record_dropped_frame();
                    }
                    ble_output.pending = Some(send);
                } else {
                    ble_output.last_ble_send = Instant::now();
                    spawn_ble_write(&mut ble_output, &lamp_state, send);
                }
            } else {
                metrics.record_skip_delta();
            }
        } else {
            metrics.record_skip_rate_limit();
        }

        let frame_event = AmbientFrameEvent {
            r,
            g,
            b,
            hex: rgb_to_hex(r, g, b),
            computed_brightness: Some(processed.brightness),
            screen_intensity: Some(processed.screen_intensity),
        };
        let _ = app.emit("ambient://frame", frame_event);

        if settings.debug && last_debug_emit.elapsed() >= Duration::from_millis(500) {
            last_debug_emit = Instant::now();
            let debug_metrics = metrics.snapshot_with_pipeline(
                settings,
                processed.metrics.edge_intensity,
                processed.metrics.center_intensity,
                processed.metrics.spatial_intensity,
                processed.metrics.highlight_intensity,
                processed.metrics.smoothed_brightness,
                processed.target_brightness,
            );
            emit_debug_metrics(&app, &debug_metrics, settings, &mut metrics);
        }

        let sample_interval = Duration::from_millis(settings.target_sample_interval_ms());
        let elapsed_since_capture = capture_start.elapsed();
        if elapsed_since_capture < sample_interval {
            tokio::time::sleep(sample_interval - elapsed_since_capture).await;
            if *stop_rx.borrow() {
                break;
            }
        }
    }

    if let Some(handle) = ble_output.in_flight.take() {
        let _ = handle.await;
    }

    capture.stop().await;
    let _ = app.emit("ambient://status", serde_json::json!({ "status": "stopped" }));
}

fn spawn_ble_write(
    ble_output: &mut AmbientBleOutput,
    lamp_state: &SharedLampState,
    send: PendingSend,
) {
    let state = lamp_state.clone();
    let write_start = Instant::now();
    ble_output.in_flight = Some(tokio::spawn(async move {
        let result =
            write_color_if_connected(&state, send.r, send.g, send.b, send.brightness).await;
        let duration_ms = write_start.elapsed().as_secs_f32() * 1000.0;
        (result, duration_ms, send.frame)
    }));
}

async fn poll_ble_write(
    ble_output: &mut AmbientBleOutput,
    processor: &mut ColorProcessor,
    metrics: &mut AmbientMetricsCollector,
    lamp_state: &SharedLampState,
    app: &AppHandle,
) -> bool {
    let Some(handle) = ble_output.in_flight.take() else {
        if !ble_output.is_busy() {
            if let Some(pending) = ble_output.pending.take() {
                ble_output.last_ble_send = Instant::now();
                spawn_ble_write(ble_output, lamp_state, pending);
            }
        }
        return true;
    };

    if !handle.is_finished() {
        ble_output.in_flight = Some(handle);
        return true;
    }

    match handle.await {
        Ok((Ok(()), duration_ms, frame)) => {
            metrics.record_ble_write(duration_ms);
            processor.mark_sent(&frame);
            if let Some(pending) = ble_output.pending.take() {
                ble_output.last_ble_send = Instant::now();
                spawn_ble_write(ble_output, lamp_state, pending);
            }
        }
        Ok((Err(LampError::ConnectionStale | LampError::NotConnected | LampError::WriteFailure), _, _))
        | Ok((Err(_), _, _))
        | Err(_) => {
            metrics.record_ble_failure();
            metrics.record_skip_stale();
            emit_connection_lost(app);
            return false;
        }
    }

    true
}

fn emit_debug_metrics(
    app: &AppHandle,
    debug_metrics: &AmbientDebugMetrics,
    settings: &AmbientSettings,
    metrics: &mut AmbientMetricsCollector,
) {
    if metrics.check_sustain_notice(settings.output_fps, debug_metrics.actual_output_fps) {
        let _ = app.emit(
            "ambient://notice",
            serde_json::json!({
                "message": format!(
                    "Ambient Mode could not sustain {} FPS. Try 15 FPS or Balanced quality.",
                    settings.output_fps
                )
            }),
        );
    }
    let _ = app.emit("ambient://debug-metrics", debug_metrics.clone());
}

fn emit_connection_lost(app: &AppHandle) {
    let _ = app.emit(
        "ambient://stopped",
        AmbientStoppedEvent {
            reason: AmbientStopReason::ConnectionLost,
            message: Some(
                "Ambient Mode stopped because the lamp connection became stale.".to_string(),
            ),
        },
    );
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

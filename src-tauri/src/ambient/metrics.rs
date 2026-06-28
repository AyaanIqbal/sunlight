use super::types::{AmbientDebugMetrics, AmbientSettings};
use std::time::Instant;

const EMA_ALPHA: f32 = 0.1;
const FPS_WINDOW: usize = 30;

#[derive(Default)]
struct RollingAvg {
    avg: f32,
    initialized: bool,
}

impl RollingAvg {
    fn record(&mut self, value: f32) {
        if self.initialized {
            self.avg = self.avg * (1.0 - EMA_ALPHA) + value * EMA_ALPHA;
        } else {
            self.avg = value;
            self.initialized = true;
        }
    }

    fn value(&self) -> f32 {
        self.avg
    }
}

pub struct AmbientMetricsCollector {
    capture_avg: RollingAvg,
    downsample_avg: RollingAvg,
    algorithm_avg: RollingAvg,
    processing_avg: RollingAvg,
    ble_write_avg: RollingAvg,
    output_interval_avg: RollingAvg,

    capture_last: f32,
    processing_last: f32,
    ble_write_last: f32,

    capture_failures: u32,
    ble_write_failures: u32,
    skipped_due_to_delta: u32,
    skipped_due_to_rate_limit: u32,
    skipped_due_to_duplicate: u32,
    skipped_due_to_stale_connection: u32,
    ble_busy_skips: u32,
    dropped_frames: u32,

    sample_times: Vec<Instant>,
    ble_times: Vec<Instant>,

    last_frame_at: Option<Instant>,
    last_ble_send_at: Option<Instant>,
    last_output_interval_ms: f32,

    color_delta_last: u32,
    brightness_delta_last: u32,
    computed_brightness: u8,
    screen_intensity: f32,
    ble_writes_in_flight: u8,

    sustain_low_count: u32,
    sustain_notice_sent: bool,
}

impl Default for AmbientMetricsCollector {
    fn default() -> Self {
        Self {
            capture_avg: RollingAvg::default(),
            downsample_avg: RollingAvg::default(),
            algorithm_avg: RollingAvg::default(),
            processing_avg: RollingAvg::default(),
            ble_write_avg: RollingAvg::default(),
            output_interval_avg: RollingAvg::default(),
            capture_last: 0.0,
            processing_last: 0.0,
            ble_write_last: 0.0,
            capture_failures: 0,
            ble_write_failures: 0,
            skipped_due_to_delta: 0,
            skipped_due_to_rate_limit: 0,
            skipped_due_to_duplicate: 0,
            skipped_due_to_stale_connection: 0,
            ble_busy_skips: 0,
            dropped_frames: 0,
            sample_times: Vec::with_capacity(FPS_WINDOW),
            ble_times: Vec::with_capacity(FPS_WINDOW),
            last_frame_at: None,
            last_ble_send_at: None,
            last_output_interval_ms: 0.0,
            color_delta_last: 0,
            brightness_delta_last: 0,
            computed_brightness: 0,
            screen_intensity: 0.0,
            ble_writes_in_flight: 0,
            sustain_low_count: 0,
            sustain_notice_sent: false,
        }
    }
}

impl AmbientMetricsCollector {
    pub fn record_capture(&mut self, total_ms: f32, downsample_ms: f32) {
        self.capture_avg.record(total_ms);
        self.downsample_avg.record(downsample_ms);
        self.capture_last = total_ms;
        self.push_sample_time();
        self.last_frame_at = Some(Instant::now());
    }

    pub fn record_capture_failure(&mut self) {
        self.capture_failures += 1;
    }

    pub fn record_processing(&mut self, total_ms: f32, algorithm_ms: f32) {
        self.processing_avg.record(total_ms);
        self.algorithm_avg.record(algorithm_ms);
        self.processing_last = total_ms;
    }

    pub fn record_ble_write(&mut self, duration_ms: f32) {
        self.ble_write_avg.record(duration_ms);
        self.ble_write_last = duration_ms;
        if let Some(prev) = self.last_ble_send_at {
            let interval = prev.elapsed().as_secs_f32() * 1000.0;
            self.last_output_interval_ms = interval;
            self.output_interval_avg.record(interval);
        }
        self.last_ble_send_at = Some(Instant::now());
        self.push_ble_time();
    }

    pub fn record_ble_failure(&mut self) {
        self.ble_write_failures += 1;
    }

    pub fn set_ble_writes_in_flight(&mut self, count: u8) {
        self.ble_writes_in_flight = count;
    }

    pub fn record_skip_rate_limit(&mut self) {
        self.skipped_due_to_rate_limit += 1;
    }

    pub fn record_skip_delta(&mut self) {
        self.skipped_due_to_delta += 1;
    }

    pub fn record_skip_duplicate(&mut self) {
        self.skipped_due_to_duplicate += 1;
    }

    pub fn record_skip_stale(&mut self) {
        self.skipped_due_to_stale_connection += 1;
    }

    pub fn record_ble_busy_skip(&mut self) {
        self.ble_busy_skips += 1;
    }

    pub fn record_dropped_frame(&mut self) {
        self.dropped_frames += 1;
    }

    pub fn set_output_deltas(&mut self, color_delta: u32, brightness_delta: u32) {
        self.color_delta_last = color_delta;
        self.brightness_delta_last = brightness_delta;
    }

    pub fn set_output_state(&mut self, brightness: u8, screen_intensity: f32) {
        self.computed_brightness = brightness;
        self.screen_intensity = screen_intensity;
    }

    pub fn reset_sustain_notice(&mut self) {
        self.sustain_low_count = 0;
        self.sustain_notice_sent = false;
    }

    /// Returns true if a sustain notice should be emitted (once until recovery).
    pub fn check_sustain_notice(&mut self, target_fps: u8, actual_fps: f32) -> bool {
        if actual_fps >= target_fps as f32 * 0.75 {
            self.sustain_low_count = 0;
            self.sustain_notice_sent = false;
            return false;
        }
        self.sustain_low_count += 1;
        if self.sustain_low_count >= 5 && !self.sustain_notice_sent {
            self.sustain_notice_sent = true;
            return true;
        }
        false
    }

    pub fn snapshot(&self, settings: &AmbientSettings) -> AmbientDebugMetrics {
        AmbientDebugMetrics {
            capture_fps: compute_fps(&self.sample_times),
            target_capture_fps: Some(settings.target_capture_fps()),
            capture_time_ms_avg: self.capture_avg.value(),
            capture_time_ms_last: self.capture_last,
            capture_failures: self.capture_failures,
            processing_time_ms_avg: self.processing_avg.value(),
            processing_time_ms_last: self.processing_last,
            downsample_time_ms_avg: Some(self.downsample_avg.value()),
            algorithm_time_ms_avg: Some(self.algorithm_avg.value()),
            target_output_fps: settings.output_fps as f32,
            actual_output_fps: compute_fps(&self.ble_times),
            output_interval_ms_avg: self.output_interval_avg.value(),
            time_since_last_frame_ms: self
                .last_frame_at
                .map(|t| t.elapsed().as_secs_f32() * 1000.0)
                .unwrap_or(0.0),
            time_since_last_ble_send_ms: self
                .last_ble_send_at
                .map(|t| t.elapsed().as_secs_f32() * 1000.0)
                .unwrap_or(0.0),
            ble_write_time_ms_avg: self.ble_write_avg.value(),
            ble_write_time_ms_last: self.ble_write_last,
            ble_write_failures: self.ble_write_failures,
            ble_writes_in_flight: Some(self.ble_writes_in_flight),
            ble_busy_skips: Some(self.ble_busy_skips),
            skipped_due_to_delta: self.skipped_due_to_delta,
            skipped_due_to_rate_limit: self.skipped_due_to_rate_limit,
            skipped_due_to_duplicate: self.skipped_due_to_duplicate,
            skipped_due_to_stale_connection: self.skipped_due_to_stale_connection,
            dropped_frames: Some(self.dropped_frames),
            color_delta_last: self.color_delta_last,
            brightness_delta_last: self.brightness_delta_last,
            computed_brightness: self.computed_brightness,
            screen_intensity: self.screen_intensity,
            edge_intensity: None,
            center_intensity: None,
            spatial_intensity: None,
            highlight_intensity: None,
            smoothed_brightness: None,
            target_brightness: None,
            brightness_mode: None,
            black_threshold: None,
            center_contribution: None,
            highlight_influence: None,
        }
    }

    pub fn snapshot_with_pipeline(
        &self,
        settings: &AmbientSettings,
        edge_intensity: f32,
        center_intensity: f32,
        spatial_intensity: f32,
        highlight_intensity: f32,
        smoothed_brightness: u8,
        target_brightness: u8,
    ) -> AmbientDebugMetrics {
        let mut m = self.snapshot(settings);
        m.edge_intensity = Some(edge_intensity);
        m.center_intensity = Some(center_intensity);
        m.spatial_intensity = Some(spatial_intensity);
        m.highlight_intensity = Some(highlight_intensity);
        m.smoothed_brightness = Some(smoothed_brightness);
        m.target_brightness = Some(target_brightness);
        m.brightness_mode = Some(settings.brightness_mode.clone());
        m.black_threshold = Some(settings.black_threshold);
        m.center_contribution = Some(settings.center_contribution);
        m.highlight_influence = Some(settings.highlight_influence);
        m
    }

    fn push_sample_time(&mut self) {
        self.sample_times.push(Instant::now());
        if self.sample_times.len() > FPS_WINDOW {
            self.sample_times.remove(0);
        }
    }

    fn push_ble_time(&mut self) {
        self.ble_times.push(Instant::now());
        if self.ble_times.len() > FPS_WINDOW {
            self.ble_times.remove(0);
        }
    }
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

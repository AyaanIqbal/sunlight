use super::metrics::AmbientMetricsCollector;
use super::types::fps_to_interval_ms;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const MIN_FPS: u8 = 15;
const INITIAL_FPS: u8 = 30;
const MAX_FPS: u8 = 60;
const WARMUP: Duration = Duration::from_secs(3);
const ADJUSTMENT_COOLDOWN: Duration = Duration::from_secs(3);
const STABLE_BEFORE_INCREASE: Duration = Duration::from_secs(4);
const INCREASE_STEP: u8 = 5;
const DECREASE_STEP: u8 = 10;

const CAPTURE_BUDGET_THRESHOLD: f32 = 0.85;
const CAPTURE_HEADROOM_THRESHOLD: f32 = 0.55;
const BLE_BUDGET_THRESHOLD: f32 = 0.85;
const BLE_HEADROOM_THRESHOLD: f32 = 0.55;
const CAPTURE_FPS_RATIO: f32 = 0.85;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdaptiveState {
    WarmingUp,
    Stable,
    Increasing,
    Decreasing,
    Limited,
}

impl AdaptiveState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WarmingUp => "warming_up",
            Self::Stable => "stable",
            Self::Increasing => "increasing",
            Self::Decreasing => "decreasing",
            Self::Limited => "limited",
        }
    }
}

#[derive(Debug, Clone)]
pub struct AdaptiveSnapshot {
    pub target_fps: f32,
    pub capture_target_fps: f32,
    pub output_target_fps: f32,
    pub state: AdaptiveState,
    pub reason: Option<String>,
    pub last_adjustment_at: Option<String>,
    pub frame_budget_ms: f32,
    pub stability_score: f32,
    pub recent_ble_failure_delta: u32,
}

pub struct AdaptiveController {
    capture_target_fps: u8,
    output_target_fps: u8,
    state: AdaptiveState,
    started_at: Instant,
    last_adjustment_at: Instant,
    stable_since: Instant,
    reason: Option<String>,
    last_busy_skips: u32,
    last_dropped_frames: u32,
    last_rate_limit_skips: u32,
    last_ble_failures: u32,
    recent_ble_failure_delta: u32,
}

impl AdaptiveController {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            capture_target_fps: INITIAL_FPS,
            output_target_fps: INITIAL_FPS,
            state: AdaptiveState::WarmingUp,
            started_at: now,
            last_adjustment_at: now,
            stable_since: now,
            reason: Some("Initialized at 30 FPS".to_string()),
            last_busy_skips: 0,
            last_dropped_frames: 0,
            last_rate_limit_skips: 0,
            last_ble_failures: 0,
            recent_ble_failure_delta: 0,
        }
    }

    pub fn capture_target_fps(&self) -> u8 {
        self.capture_target_fps
    }

    pub fn output_target_fps(&self) -> u8 {
        self.output_target_fps
    }

    pub fn capture_interval_ms(&self) -> u64 {
        fps_to_interval_ms(self.capture_target_fps)
    }

    pub fn output_interval_ms(&self) -> u64 {
        fps_to_interval_ms(self.output_target_fps)
    }

    pub fn snapshot(&self) -> AdaptiveSnapshot {
        let target_fps = self.capture_target_fps.max(self.output_target_fps) as f32;
        AdaptiveSnapshot {
            target_fps,
            capture_target_fps: self.capture_target_fps as f32,
            output_target_fps: self.output_target_fps as f32,
            state: self.state,
            reason: self.reason.clone(),
            last_adjustment_at: if self.reason.is_some() {
                Some(iso_timestamp_from_instant(self.last_adjustment_at))
            } else {
                None
            },
            frame_budget_ms: frame_budget_ms(self.capture_target_fps),
            stability_score: self.compute_stability_score(),
            recent_ble_failure_delta: self.recent_ble_failure_delta,
        }
    }

    /// Returns true when capture/output targets changed.
    pub fn tick(&mut self, metrics: &AmbientMetricsCollector, now: Instant) -> bool {
        if now.duration_since(self.started_at) < WARMUP {
            self.state = AdaptiveState::WarmingUp;
            return false;
        }

        if now.duration_since(self.last_adjustment_at) < ADJUSTMENT_COOLDOWN {
            return false;
        }

        let capture_fps = metrics.capture_fps();
        let capture_time_avg = metrics.capture_time_avg();
        let processing_time_avg = metrics.processing_time_avg();
        let ble_write_avg = metrics.ble_write_time_avg();
        let busy_skips = metrics.ble_busy_skips();
        let dropped_frames = metrics.dropped_frames();
        let ble_failures = metrics.ble_write_failures();
        let rate_limit_skips = metrics.rate_limit_skips();
        let duplicate_skips = metrics.duplicate_skips();
        let delta_skips = metrics.delta_skips();

        let ble_failures_delta = ble_failures.saturating_sub(self.last_ble_failures);
        self.recent_ble_failure_delta = ble_failures_delta;

        let capture_budget = frame_budget_ms(self.capture_target_fps);
        let output_budget = frame_budget_ms(self.output_target_fps);
        let pipeline_time = capture_time_avg + processing_time_avg;

        let busy_skips_delta = busy_skips.saturating_sub(self.last_busy_skips);
        let dropped_delta = dropped_frames.saturating_sub(self.last_dropped_frames);
        let rate_limit_delta = rate_limit_skips.saturating_sub(self.last_rate_limit_skips);

        self.last_busy_skips = busy_skips;
        self.last_dropped_frames = dropped_frames;
        self.last_rate_limit_skips = rate_limit_skips;
        self.last_ble_failures = ble_failures;

        let capture_over_budget = pipeline_time > capture_budget * CAPTURE_BUDGET_THRESHOLD;
        let capture_fps_low =
            capture_fps > 0.0 && capture_fps < self.capture_target_fps as f32 * CAPTURE_FPS_RATIO;
        let ble_over_budget = ble_write_avg > output_budget * BLE_BUDGET_THRESHOLD;
        let ble_pressure =
            busy_skips_delta >= 3 || dropped_delta >= 2 || ble_failures_delta > 0;
        let loop_overloaded = rate_limit_delta >= 8 && duplicate_skips + delta_skips < rate_limit_delta / 2;

        let severe = ble_failures_delta > 0
            || dropped_delta >= 5
            || (capture_over_budget && pipeline_time > capture_budget * 1.2);

        if capture_over_budget || capture_fps_low || loop_overloaded {
            let reason = if capture_over_budget {
                "decreased due to capture time near budget"
            } else if capture_fps_low {
                "decreased due to capture FPS below target"
            } else {
                "decreased due to loop overload (rate-limit skips)"
            };
            return self.decrease_capture(reason, severe, now);
        }

        if ble_over_budget || ble_pressure {
            let reason = if ble_failures_delta > 0 {
                "decreased output due to BLE failures"
            } else if dropped_delta >= 2 {
                "decreased output due to dropped frames"
            } else if busy_skips_delta >= 3 {
                "decreased output due to BLE busy skips"
            } else {
                "decreased output due to BLE write time near budget"
            };
            return self.decrease_output(reason, severe, now);
        }

        let capture_headroom = pipeline_time < capture_budget * CAPTURE_HEADROOM_THRESHOLD;
        let ble_headroom = ble_write_avg < output_budget * BLE_HEADROOM_THRESHOLD;
        let skips_low =
            busy_skips_delta == 0 && dropped_delta == 0 && ble_failures_delta == 0;
        let capture_sustained =
            capture_fps <= 0.0 || capture_fps >= self.capture_target_fps as f32 * CAPTURE_FPS_RATIO;

        if capture_headroom
            && ble_headroom
            && skips_low
            && capture_sustained
            && now.duration_since(self.stable_since) >= STABLE_BEFORE_INCREASE
        {
            if self.capture_target_fps >= MAX_FPS && self.output_target_fps >= MAX_FPS {
                self.state = AdaptiveState::Limited;
                return false;
            }
            return self.increase(now);
        }

        self.state = AdaptiveState::Stable;
        false
    }

    fn decrease_capture(&mut self, reason: &str, severe: bool, now: Instant) -> bool {
        let prev_capture = self.capture_target_fps;
        let prev_output = self.output_target_fps;

        self.capture_target_fps = if severe {
            ((self.capture_target_fps as f32 / 2.0).round() as u8).max(MIN_FPS)
        } else {
            self.capture_target_fps.saturating_sub(DECREASE_STEP).max(MIN_FPS)
        };
        self.output_target_fps = self.output_target_fps.min(self.capture_target_fps);

        if self.capture_target_fps == prev_capture && self.output_target_fps == prev_output {
            self.state = AdaptiveState::Limited;
            return false;
        }

        self.apply_adjustment(
            AdaptiveState::Decreasing,
            reason,
            now,
        );
        true
    }

    fn decrease_output(&mut self, reason: &str, severe: bool, now: Instant) -> bool {
        let prev = self.output_target_fps;
        self.output_target_fps = if severe {
            ((self.output_target_fps as f32 / 2.0).round() as u8).max(MIN_FPS)
        } else {
            self.output_target_fps.saturating_sub(DECREASE_STEP).max(MIN_FPS)
        };

        if self.output_target_fps == prev {
            self.state = AdaptiveState::Limited;
            return false;
        }

        self.apply_adjustment(AdaptiveState::Decreasing, reason, now);
        true
    }

    fn increase(&mut self, now: Instant) -> bool {
        let prev_capture = self.capture_target_fps;
        let prev_output = self.output_target_fps;

        if self.capture_target_fps < MAX_FPS {
            self.capture_target_fps = (self.capture_target_fps + INCREASE_STEP).min(MAX_FPS);
        }
        if self.output_target_fps < MAX_FPS {
            self.output_target_fps = (self.output_target_fps + INCREASE_STEP).min(MAX_FPS);
        }
        self.output_target_fps = self.output_target_fps.min(self.capture_target_fps);

        if self.capture_target_fps == prev_capture && self.output_target_fps == prev_output {
            self.state = AdaptiveState::Limited;
            return false;
        }

        self.apply_adjustment(
            AdaptiveState::Increasing,
            "increased after stable performance",
            now,
        );
        true
    }

    fn apply_adjustment(&mut self, state: AdaptiveState, reason: &str, now: Instant) {
        self.state = state;
        self.reason = Some(reason.to_string());
        self.last_adjustment_at = now;
        self.stable_since = now;
    }

    fn compute_stability_score(&self) -> f32 {
        if self.capture_target_fps >= MAX_FPS && self.output_target_fps >= MAX_FPS {
            return 100.0;
        }
        let headroom = (MAX_FPS - self.capture_target_fps.min(self.output_target_fps)) as f32;
        (100.0 - (headroom / (MAX_FPS - MIN_FPS) as f32) * 40.0).clamp(0.0, 100.0)
    }
}

fn frame_budget_ms(fps: u8) -> f32 {
    1000.0 / fps.max(1) as f32
}

fn iso_timestamp_from_instant(instant: Instant) -> String {
    let elapsed = instant.elapsed();
    let adjusted = SystemTime::now()
        .checked_sub(elapsed)
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let duration = adjusted.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}.{:03}Z", duration.as_secs(), duration.subsec_millis())
}

use super::color::{PixelSample, SampleRegion};
use super::types::AmbientSettings;

const WHITE_POINT: f32 = 0.80;

#[derive(Debug, Clone, Copy, Default)]
pub struct IntensityMetrics {
    pub edge_intensity: f32,
    pub center_intensity: f32,
    pub spatial_intensity: f32,
    pub highlight_intensity: f32,
    pub screen_intensity: f32,
}

pub fn pixel_intensity(rgb_r: f32, rgb_g: f32, rgb_b: f32, hsv_v: f32) -> f32 {
    let r = rgb_r / 255.0;
    let g = rgb_g / 255.0;
    let b = rgb_b / 255.0;
    let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    0.70 * luminance + 0.30 * hsv_v
}

pub fn compute_intensity_metrics(
    samples: &[PixelSample],
    settings: &AmbientSettings,
) -> IntensityMetrics {
    let center_contrib = settings.center_contribution.clamp(0.0, 0.35);
    let highlight_influence = settings.highlight_influence.clamp(0.0, 0.6);

    let mut edge_sum = 0.0f32;
    let mut edge_weight = 0.0f32;
    let mut center_sum = 0.0f32;
    let mut center_count = 0u32;
    let mut all_intensities: Vec<f32> = Vec::with_capacity(samples.len());

    for s in samples {
        all_intensities.push(s.intensity);
        match s.region {
            SampleRegion::Edge => {
                edge_sum += s.intensity * s.edge_weight;
                edge_weight += s.edge_weight;
            }
            SampleRegion::Center => {
                center_sum += s.intensity;
                center_count += 1;
            }
        }
    }

    let edge_intensity = if edge_weight > 0.0 {
        edge_sum / edge_weight
    } else {
        0.0
    };

    let center_intensity = if center_count > 0 {
        center_sum / center_count as f32
    } else {
        edge_intensity
    };

    let spatial_intensity =
        (1.0 - center_contrib) * edge_intensity + center_contrib * center_intensity;

    let highlight_intensity = compute_highlight_intensity(&all_intensities);

    let screen_intensity = ((1.0 - highlight_influence) * spatial_intensity
        + highlight_influence * highlight_intensity)
        .clamp(0.0, 1.0);

    IntensityMetrics {
        edge_intensity,
        center_intensity,
        spatial_intensity,
        highlight_intensity,
        screen_intensity,
    }
}

fn compute_highlight_intensity(intensities: &[f32]) -> f32 {
    if intensities.is_empty() {
        return 0.0;
    }
    let mut sorted = intensities.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let idx = ((sorted.len() as f32) * 0.90).floor() as usize;
    let idx = idx.min(sorted.len() - 1);
    sorted[idx]
}

struct ResponseCurve {
    gamma: f32,
    min_active: u8,
    max_brightness: u8,
}

fn response_curve(settings: &AmbientSettings) -> ResponseCurve {
    let (base_gamma, base_min) = match settings.brightness_response.as_str() {
        "balanced" => (0.95f32, 5u8),
        "brighter" => (0.70, 10),
        _ => (1.35, 3), // dimmer default
    };

    let t = settings.brightness_response_fine_tune.clamp(0.0, 1.0);
    let dimmer_gamma = 1.35f32;
    let dimmer_min = 3u8;
    let brighter_gamma = 0.70f32;
    let brighter_min = 10u8;

    let gamma = dimmer_gamma + t * (brighter_gamma - dimmer_gamma);
    let min_active = (dimmer_min as f32 + t * (brighter_min as f32 - dimmer_min as f32)).round() as u8;

    // Blend preset anchor with fine-tune interpolation
    let gamma = base_gamma * 0.5 + gamma * 0.5;
    let min_active = ((base_min as f32 + min_active as f32) * 0.5).round() as u8;

    let max_brightness = settings.max_brightness.clamp(1, 64);
    let min_active = settings
        .min_active_brightness
        .min(max_brightness)
        .max(min_active.min(max_brightness));

    ResponseCurve {
        gamma,
        min_active,
        max_brightness,
    }
}

pub fn map_intensity_to_brightness(screen_intensity: f32, settings: &AmbientSettings) -> u8 {
    let black_threshold = settings.black_threshold.clamp(0.01, 0.2);

    if screen_intensity < black_threshold {
        return 0;
    }

    let curve = response_curve(settings);
    let range = WHITE_POINT - black_threshold;
    if range <= f32::EPSILON {
        return 0;
    }

    let normalized = ((screen_intensity - black_threshold) / range).clamp(0.0, 1.0);
    let curved = normalized.powf(curve.gamma);
    let brightness = curve.min_active as f32
        + curved * (curve.max_brightness as f32 - curve.min_active as f32);

    brightness.round().clamp(0.0, 64.0) as u8
}

pub struct BrightnessSmoother {
    smoothed: Option<f32>,
    black_fade_frames: u8,
}

impl Default for BrightnessSmoother {
    fn default() -> Self {
        Self {
            smoothed: None,
            black_fade_frames: 0,
        }
    }
}

impl BrightnessSmoother {
    pub fn reset(&mut self) {
        self.smoothed = None;
        self.black_fade_frames = 0;
    }

    pub fn smooth(&mut self, target: u8, settings: &AmbientSettings) -> u8 {
        let target_f = target as f32;
        let base_smoothing = settings.brightness_smoothing.clamp(0.05, 0.6);

        let smoothing = if target == 0 {
            self.black_fade_frames = self.black_fade_frames.saturating_add(1);
            base_smoothing.max(0.48)
        } else {
            self.black_fade_frames = 0;
            base_smoothing
        };

        let prev = match self.smoothed {
            Some(p) => p,
            None => {
                self.smoothed = Some(target_f);
                return target;
            }
        };

        let smoothed = prev * (1.0 - smoothing) + target_f * smoothing;
        self.smoothed = Some(smoothed);
        smoothed.round().clamp(0.0, 64.0) as u8
    }
}

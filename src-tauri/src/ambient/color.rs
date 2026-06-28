use super::brightness::{
    compute_intensity_metrics, map_intensity_to_brightness, pixel_intensity, BrightnessSmoother,
};
use super::types::AmbientSettings;

#[derive(Clone, Copy, Debug, Default)]
pub struct Rgb {
    pub r: f32,
    pub g: f32,
    pub b: f32,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Hsv {
    h: f32,
    s: f32,
    v: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SampleRegion {
    Edge,
    Center,
}

#[derive(Clone, Copy, Debug)]
pub struct PixelSample {
    pub rgb: Rgb,
    pub hsv: Hsv,
    pub edge_weight: f32,
    pub intensity: f32,
    pub region: SampleRegion,
}

#[derive(Clone, Copy, Debug)]
pub struct FrameMetrics {
    pub edge_intensity: f32,
    pub center_intensity: f32,
    pub spatial_intensity: f32,
    pub highlight_intensity: f32,
    pub smoothed_brightness: u8,
}

#[derive(Clone, Copy, Debug)]
pub struct ProcessedFrame {
    pub rgb: Rgb,
    pub brightness: u8,
    pub target_brightness: u8,
    pub screen_intensity: f32,
    pub metrics: FrameMetrics,
}

const HUE_BUCKETS: usize = 36;
const HIGHLIGHT_BIAS: f32 = 0.6;

pub struct ColorProcessor {
    smoothed: Option<Rgb>,
    previous_sent: Option<Rgb>,
    previous_sent_brightness: Option<u8>,
    brightness_smoother: BrightnessSmoother,
}

impl Default for ColorProcessor {
    fn default() -> Self {
        Self {
            smoothed: None,
            previous_sent: None,
            previous_sent_brightness: None,
            brightness_smoother: BrightnessSmoother::default(),
        }
    }
}

impl ColorProcessor {
    pub fn reset(&mut self) {
        self.smoothed = None;
        self.previous_sent = None;
        self.previous_sent_brightness = None;
        self.brightness_smoother.reset();
    }

    pub fn process_frame(
        &mut self,
        pixels: &[u8],
        width: u32,
        height: u32,
        bytes_per_row: usize,
        settings: &AmbientSettings,
        manual_brightness: u8,
    ) -> ProcessedFrame {
        let samples = collect_samples(pixels, width, height, bytes_per_row, settings);
        let intensity = compute_intensity_metrics(&samples, settings);
        let target_brightness = map_intensity_to_brightness(intensity.screen_intensity, settings);

        let below_black = intensity.screen_intensity < settings.black_threshold.clamp(0.01, 0.2);

        let raw_rgb = if below_black {
            self.smoothed.unwrap_or_default()
        } else {
            compute_rgb(&samples, settings, self.smoothed, intensity.screen_intensity)
        };

        let smoothed_rgb = apply_smoothing(raw_rgb, settings, self.smoothed);
        self.smoothed = Some(smoothed_rgb);

        let computed_brightness = self
            .brightness_smoother
            .smooth(target_brightness, settings);

        let brightness = if settings.is_dynamic_brightness() {
            computed_brightness
        } else {
            manual_brightness
        };

        let metrics = FrameMetrics {
            edge_intensity: intensity.edge_intensity,
            center_intensity: intensity.center_intensity,
            spatial_intensity: intensity.spatial_intensity,
            highlight_intensity: intensity.highlight_intensity,
            smoothed_brightness: computed_brightness,
        };

        ProcessedFrame {
            rgb: smoothed_rgb,
            brightness,
            target_brightness,
            screen_intensity: intensity.screen_intensity,
            metrics,
        }
    }

    pub fn should_send(&self, frame: &ProcessedFrame, settings: &AmbientSettings) -> bool {
        let (r, g, b) = (
            frame.rgb.r.round() as i32,
            frame.rgb.g.round() as i32,
            frame.rgb.b.round() as i32,
        );
        let brightness = frame.brightness;

        match self.previous_sent {
            Some(prev) => {
                let rgb_delta = (prev.r.round() as i32 - r).abs()
                    + (prev.g.round() as i32 - g).abs()
                    + (prev.b.round() as i32 - b).abs();
                let brightness_delta = self
                    .previous_sent_brightness
                    .map(|pb| (pb as i32 - brightness as i32).abs())
                    .unwrap_or(255);

                if brightness == 0
                    && self.previous_sent_brightness == Some(0)
                    && rgb_delta < settings.min_color_delta as i32
                {
                    return false;
                }

                rgb_delta >= settings.min_color_delta as i32 || brightness_delta >= 2
            }
            None => true,
        }
    }

    pub fn mark_sent(&mut self, frame: &ProcessedFrame) {
        self.previous_sent = Some(frame.rgb);
        self.previous_sent_brightness = Some(frame.brightness);
    }
}

fn collect_samples(
    pixels: &[u8],
    width: u32,
    height: u32,
    bytes_per_row: usize,
    settings: &AmbientSettings,
) -> Vec<PixelSample> {
    let band_frac = settings.edge_band_fraction();
    let weight_scale = settings.edge_weight_scale();
    let w = width as usize;
    let h = height as usize;
    let band_x = ((w as f32) * band_frac).max(1.0) as usize;
    let band_y = ((h as f32) * band_frac).max(1.0) as usize;

    let mut samples = Vec::with_capacity(w * h);

    for y in 0..h {
        let in_y_band = y < band_y || y >= h - band_y;
        for x in 0..w {
            let in_x_band = x < band_x || x >= w - band_x;
            let region = if in_x_band || in_y_band {
                SampleRegion::Edge
            } else {
                SampleRegion::Center
            };

            let offset = y * bytes_per_row + x * 4;
            if offset + 3 >= pixels.len() {
                continue;
            }

            let b = pixels[offset] as f32;
            let g = pixels[offset + 1] as f32;
            let r = pixels[offset + 2] as f32;
            let rgb = Rgb { r, g, b };
            let hsv = rgb_to_hsv(rgb);
            let edge_weight = if region == SampleRegion::Edge {
                edge_weight_for_pixel(x, y, w, h, band_x, band_y, weight_scale)
            } else {
                1.0
            };
            let intensity = pixel_intensity(r, g, b, hsv.v);

            samples.push(PixelSample {
                rgb,
                hsv,
                edge_weight,
                intensity,
                region,
            });
        }
    }

    samples
}

fn compute_rgb(
    samples: &[PixelSample],
    settings: &AmbientSettings,
    previous_smoothed: Option<Rgb>,
    screen_intensity: f32,
) -> Rgb {
    let vivid: Vec<&PixelSample> = samples
        .iter()
        .filter(|s| !should_filter_pixel(s.hsv))
        .collect();
    let all_refs: Vec<&PixelSample> = samples.iter().collect();
    let use_for_color: &[&PixelSample] = if vivid.len() >= 8 {
        &vivid
    } else {
        &all_refs
    };

    let weighted_avg = compute_weighted_average(use_for_color, previous_smoothed, screen_intensity);
    let dominant = compute_dominant_color(use_for_color, previous_smoothed, screen_intensity);
    let hybrid = blend_colors(dominant, weighted_avg, HIGHLIGHT_BIAS);
    apply_boost(hybrid, settings)
}

fn edge_weight_for_pixel(
    x: usize,
    y: usize,
    w: usize,
    h: usize,
    band_x: usize,
    band_y: usize,
    scale: f32,
) -> f32 {
    let dist_x = x.min(w - 1 - x);
    let dist_y = y.min(h - 1 - y);
    let dist = dist_x.min(dist_y);
    let band = band_x.min(band_y).max(1);
    let t = (dist as f32) / (band as f32);
    let base = if t <= 0.35 {
        2.5
    } else if t <= 0.7 {
        1.5
    } else {
        1.0
    };
    base * scale
}

fn should_filter_pixel(hsv: Hsv) -> bool {
    if hsv.v < 0.08 {
        return true;
    }
    if hsv.v > 0.92 && hsv.s < 0.15 {
        return true;
    }
    if hsv.s < 0.08 {
        return true;
    }
    false
}

fn compute_weighted_average(
    samples: &[&PixelSample],
    previous: Option<Rgb>,
    screen_intensity: f32,
) -> Rgb {
    let mut total_w = 0.0f32;
    let mut acc = Rgb::default();

    for s in samples {
        let w = s.edge_weight * (0.5 + s.hsv.s) * (0.5 + s.hsv.v);
        total_w += w;
        acc.r += s.rgb.r * w;
        acc.g += s.rgb.g * w;
        acc.b += s.rgb.b * w;
    }

    if total_w <= 0.0 {
        return fallback_rgb(previous, screen_intensity);
    }

    Rgb {
        r: acc.r / total_w,
        g: acc.g / total_w,
        b: acc.b / total_w,
    }
}

fn compute_dominant_color(
    samples: &[&PixelSample],
    previous: Option<Rgb>,
    screen_intensity: f32,
) -> Rgb {
    let mut bucket_weights = [0.0f32; HUE_BUCKETS];
    let mut bucket_rgb = vec![Rgb::default(); HUE_BUCKETS];
    let mut bucket_counts = [0u32; HUE_BUCKETS];

    for s in samples {
        if s.hsv.s < 0.05 {
            continue;
        }
        let bucket = ((s.hsv.h / 360.0) * HUE_BUCKETS as f32) as usize;
        let bucket = bucket.min(HUE_BUCKETS - 1);
        let w = s.hsv.s * s.hsv.v * s.edge_weight;
        bucket_weights[bucket] += w;
        bucket_rgb[bucket].r += s.rgb.r * w;
        bucket_rgb[bucket].g += s.rgb.g * w;
        bucket_rgb[bucket].b += s.rgb.b * w;
        bucket_counts[bucket] += 1;
    }

    let (best_idx, best_w) = bucket_weights
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, w)| (i, *w))
        .unwrap_or((0, 0.0));

    if best_w < 0.01 || bucket_counts[best_idx] == 0 {
        return compute_weighted_average(samples, previous, screen_intensity);
    }

    Rgb {
        r: bucket_rgb[best_idx].r / best_w,
        g: bucket_rgb[best_idx].g / best_w,
        b: bucket_rgb[best_idx].b / best_w,
    }
}

fn fallback_rgb(previous: Option<Rgb>, screen_intensity: f32) -> Rgb {
    if let Some(prev) = previous {
        return prev;
    }
    let dim = (screen_intensity * 40.0).clamp(8.0, 32.0);
    Rgb {
        r: dim,
        g: dim,
        b: dim,
    }
}

fn blend_colors(dominant: Rgb, average: Rgb, bias: f32) -> Rgb {
    let avg_bias = 1.0 - bias;
    Rgb {
        r: dominant.r * bias + average.r * avg_bias,
        g: dominant.g * bias + average.g * avg_bias,
        b: dominant.b * bias + average.b * avg_bias,
    }
}

fn apply_boost(color: Rgb, settings: &AmbientSettings) -> Rgb {
    let hsv = rgb_to_hsv(color);
    let boosted = Hsv {
        h: hsv.h,
        s: (hsv.s * settings.saturation_boost).min(1.0),
        v: (hsv.v * settings.brightness_boost).min(0.95),
    };
    let rgb = hsv_to_rgb(boosted);
    Rgb {
        r: rgb.r.clamp(0.0, 255.0),
        g: rgb.g.clamp(0.0, 255.0),
        b: rgb.b.clamp(0.0, 255.0),
    }
}

fn apply_smoothing(new_color: Rgb, settings: &AmbientSettings, previous: Option<Rgb>) -> Rgb {
    let prev = match previous {
        Some(p) => p,
        None => return new_color,
    };

    let dist = color_distance(prev, new_color);
    let responsiveness = settings.responsiveness.clamp(0.0, 1.0);
    let smooth_mult = 1.4 - responsiveness * 0.8;
    let base = if dist < 30.0 {
        0.15
    } else if dist < 80.0 {
        0.25
    } else {
        0.45
    };
    let smoothing = (base * smooth_mult).clamp(0.08, 0.6);

    Rgb {
        r: prev.r * (1.0 - smoothing) + new_color.r * smoothing,
        g: prev.g * (1.0 - smoothing) + new_color.g * smoothing,
        b: prev.b * (1.0 - smoothing) + new_color.b * smoothing,
    }
}

fn color_distance(a: Rgb, b: Rgb) -> f32 {
    (a.r - b.r).abs() + (a.g - b.g).abs() + (a.b - b.b).abs()
}

fn rgb_to_hsv(rgb: Rgb) -> Hsv {
    let r = rgb.r / 255.0;
    let g = rgb.g / 255.0;
    let b = rgb.b / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;

    let h = if delta <= f32::EPSILON {
        0.0
    } else if max == r {
        60.0 * (((g - b) / delta) % 6.0)
    } else if max == g {
        60.0 * (((b - r) / delta) + 2.0)
    } else {
        60.0 * (((r - g) / delta) + 4.0)
    };

    let h = if h < 0.0 { h + 360.0 } else { h };
    let s = if max <= f32::EPSILON {
        0.0
    } else {
        delta / max
    };

    Hsv { h, s, v: max }
}

fn hsv_to_rgb(hsv: Hsv) -> Rgb {
    let c = hsv.v * hsv.s;
    let x = c * (1.0 - ((hsv.h / 60.0) % 2.0 - 1.0).abs());
    let m = hsv.v - c;

    let (r1, g1, b1) = if hsv.h < 60.0 {
        (c, x, 0.0)
    } else if hsv.h < 120.0 {
        (x, c, 0.0)
    } else if hsv.h < 180.0 {
        (0.0, c, x)
    } else if hsv.h < 240.0 {
        (0.0, x, c)
    } else if hsv.h < 300.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };

    Rgb {
        r: (r1 + m) * 255.0,
        g: (g1 + m) * 255.0,
        b: (b1 + m) * 255.0,
    }
}

pub fn downgrade_quality(settings: &mut AmbientSettings) -> bool {
    match settings.quality.as_str() {
        "responsive_detail" => {
            settings.quality = "balanced".to_string();
            true
        }
        "balanced" => {
            settings.quality = "performance".to_string();
            true
        }
        _ => false,
    }
}

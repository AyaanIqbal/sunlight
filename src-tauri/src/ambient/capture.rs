use tokio::task::JoinHandle;

pub struct FrameData {
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub bytes_per_row: usize,
    pub capture_ms: f32,
    pub downsample_ms: f32,
}

/// Result of polling the single in-flight capture task.
pub enum CapturePollResult {
    /// Capture task still running.
    InFlight,
    /// Fresh frame for the current generation.
    Ready(FrameData),
    /// xcap returned no frame.
    Failed,
    /// Result discarded (session stopped or generation mismatch).
    StaleDiscarded,
}

type CaptureTask = JoinHandle<(u64, Option<FrameData>)>;

pub struct CaptureSession {
    #[cfg(target_os = "macos")]
    monitor_id: u32,
    pub width: u32,
    pub height: u32,
    generation: u64,
    in_flight: Option<(u64, CaptureTask)>,
    stopped: bool,
}

#[cfg(target_os = "macos")]
fn capture_frame_blocking(monitor_id: u32, width: u32, height: u32) -> Option<FrameData> {
    use std::time::Instant;

    let capture_start = Instant::now();
    let monitors = xcap::Monitor::all().ok()?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.id().ok() == Some(monitor_id))?;
    let image = monitor.capture_image().ok()?;
    let grab_ms = capture_start.elapsed().as_secs_f32() * 1000.0;

    let resize_start = Instant::now();
    let resized = image::imageops::resize(
        &image,
        width,
        height,
        image::imageops::FilterType::Triangle,
    );
    let downsample_ms = resize_start.elapsed().as_secs_f32() * 1000.0;
    let capture_ms = grab_ms + downsample_ms;

    let width = resized.width();
    let height = resized.height();
    let bytes_per_row = (width as usize) * 4;
    let mut pixels = Vec::with_capacity(bytes_per_row * height as usize);
    for pixel in resized.pixels() {
        pixels.push(pixel[2]);
        pixels.push(pixel[1]);
        pixels.push(pixel[0]);
        pixels.push(pixel[3]);
    }
    Some(FrameData {
        pixels,
        width,
        height,
        bytes_per_row,
        capture_ms,
        downsample_ms,
    })
}

impl CaptureSession {
    pub async fn start(width: u32, height: u32) -> Result<Self, String> {
        #[cfg(target_os = "macos")]
        {
            let monitors = xcap::Monitor::all()
                .map_err(|e| format!("Could not list displays: {e}"))?;
            let monitor = monitors
                .into_iter()
                .next()
                .ok_or_else(|| "No display found.".to_string())?;
            let monitor_id = monitor.id().map_err(|e| format!("Could not read display id: {e}"))?;
            return Ok(Self {
                monitor_id,
                width,
                height,
                generation: 0,
                in_flight: None,
                stopped: false,
            });
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (width, height);
            Err("Ambient Mode requires macOS.".to_string())
        }
    }

    pub fn has_in_flight(&self) -> bool {
        self.in_flight
            .as_ref()
            .is_some_and(|(_, h)| !h.is_finished())
    }

    pub fn capture_in_flight(&self) -> bool {
        self.has_in_flight()
    }

    /// Start a capture if none is in flight. Returns false if busy or stopped.
    pub fn begin_capture(&mut self) -> bool {
        if self.stopped || self.has_in_flight() {
            return false;
        }

        self.generation = self.generation.wrapping_add(1);
        let gen = self.generation;

        #[cfg(target_os = "macos")]
        {
            let monitor_id = self.monitor_id;
            let width = self.width;
            let height = self.height;
            let handle = tokio::task::spawn_blocking(move || {
                (gen, capture_frame_blocking(monitor_id, width, height))
            });
            self.in_flight = Some((gen, handle));
            true
        }

        #[cfg(not(target_os = "macos"))]
        {
            false
        }
    }

    /// Poll the in-flight capture. Does not spawn new tasks.
    pub async fn poll(&mut self) -> CapturePollResult {
        if self.stopped {
            return CapturePollResult::StaleDiscarded;
        }

        let Some((gen, handle)) = self.in_flight.take() else {
            return CapturePollResult::Failed;
        };

        if !handle.is_finished() {
            self.in_flight = Some((gen, handle));
            return CapturePollResult::InFlight;
        }

        match handle.await {
            Ok((result_gen, frame)) if result_gen == self.generation && !self.stopped => {
                match frame {
                    Some(data) => CapturePollResult::Ready(data),
                    None => CapturePollResult::Failed,
                }
            }
            Ok(_) => CapturePollResult::StaleDiscarded,
            Err(_) => CapturePollResult::Failed,
        }
    }

    /// Bump generation so any in-flight result is discarded when it completes.
    pub fn invalidate_in_flight(&mut self) {
        self.generation = self.generation.wrapping_add(1);
    }

    pub async fn stop(&mut self) {
        self.stopped = true;
        self.invalidate_in_flight();
        if let Some((_, handle)) = self.in_flight.take() {
            let _ = handle.await;
        }
    }
}

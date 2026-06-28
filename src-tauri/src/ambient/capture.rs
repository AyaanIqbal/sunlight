pub struct FrameData {
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub bytes_per_row: usize,
}

pub struct CaptureSession {
    #[cfg(target_os = "macos")]
    monitor_id: u32,
    pub width: u32,
    pub height: u32,
}

#[cfg(target_os = "macos")]
fn capture_frame_blocking(monitor_id: u32, width: u32, height: u32) -> Option<FrameData> {
    let monitors = xcap::Monitor::all().ok()?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.id().ok() == Some(monitor_id))?;
    let image = monitor.capture_image().ok()?;
    let resized = image::imageops::resize(
        &image,
        width,
        height,
        image::imageops::FilterType::Triangle,
    );
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
            });
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (width, height);
            Err("Ambient Mode requires macOS.".to_string())
        }
    }

    pub async fn next_frame(&mut self) -> Option<FrameData> {
        #[cfg(target_os = "macos")]
        {
            let monitor_id = self.monitor_id;
            let width = self.width;
            let height = self.height;
            return tokio::task::spawn_blocking(move || capture_frame_blocking(monitor_id, width, height))
                .await
                .ok()
                .flatten();
        }

        #[cfg(not(target_os = "macos"))]
        {
            None
        }
    }

    pub async fn stop(self) {}
}

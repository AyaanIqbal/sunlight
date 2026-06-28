import type { AmbientSettings } from "./types";
import { DEFAULT_AMBIENT_SETTINGS } from "./types";

/** Merge partial ambient settings from older backups with current defaults. */
export function mergeAmbientSettings(raw: Partial<AmbientSettings> | undefined): AmbientSettings {
  if (!raw) return DEFAULT_AMBIENT_SETTINGS;
  return {
    ...DEFAULT_AMBIENT_SETTINGS,
    ...raw,
    quality:
      raw.quality === "performance" || raw.quality === "responsive_detail"
        ? raw.quality
        : DEFAULT_AMBIENT_SETTINGS.quality,
    outputFps:
      raw.outputFps === 4 ||
      raw.outputFps === 8 ||
      raw.outputFps === 10 ||
      raw.outputFps === 12 ||
      raw.outputFps === 15
        ? raw.outputFps
        : DEFAULT_AMBIENT_SETTINGS.outputFps,
    edgePriority:
      raw.edgePriority === "low" || raw.edgePriority === "medium"
        ? raw.edgePriority
        : DEFAULT_AMBIENT_SETTINGS.edgePriority,
    brightnessMode:
      raw.brightnessMode === "manual" ? "manual" : DEFAULT_AMBIENT_SETTINGS.brightnessMode,
    brightnessResponse:
      raw.brightnessResponse === "balanced" || raw.brightnessResponse === "brighter"
        ? raw.brightnessResponse
        : DEFAULT_AMBIENT_SETTINGS.brightnessResponse,
  };
}

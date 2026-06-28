import type { AmbientOutputRate, AmbientSettings } from "./types";
import { DEFAULT_AMBIENT_SETTINGS } from "./types";

export const VALID_OUTPUT_FPS = [4, 8, 10, 12, 15, 20, 25, 30] as const;
export const ADAPTIVE_MAX_OUTPUT_RATE = "adaptive_max" as const;

export function isAmbientFixedOutputFps(
  value: unknown
): value is (typeof VALID_OUTPUT_FPS)[number] {
  return (
    typeof value === "number" &&
    (VALID_OUTPUT_FPS as readonly number[]).includes(value)
  );
}

export function isAdaptiveMax(rate: AmbientOutputRate): boolean {
  return rate === ADAPTIVE_MAX_OUTPUT_RATE;
}

export function isAmbientOutputRate(value: unknown): value is AmbientOutputRate {
  return isAmbientFixedOutputFps(value) || value === ADAPTIVE_MAX_OUTPUT_RATE;
}

export function formatOutputRate(rate: AmbientOutputRate): string {
  if (isAdaptiveMax(rate)) return "Adaptive Max";
  return `${rate} FPS`;
}

function clampRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Merge partial ambient settings from older backups with current defaults. */
export function mergeAmbientSettings(
  raw: Partial<AmbientSettings> | undefined
): AmbientSettings {
  if (!raw) return DEFAULT_AMBIENT_SETTINGS;

  const maxBrightness = clampInt(
    raw.maxBrightness,
    1,
    64,
    DEFAULT_AMBIENT_SETTINGS.maxBrightness
  );
  let minActiveBrightness = clampInt(
    raw.minActiveBrightness,
    0,
    64,
    DEFAULT_AMBIENT_SETTINGS.minActiveBrightness
  );
  minActiveBrightness = Math.min(minActiveBrightness, maxBrightness);

  return {
    quality:
      raw.quality === "performance" || raw.quality === "responsive_detail"
        ? raw.quality
        : DEFAULT_AMBIENT_SETTINGS.quality,
    outputFps: isAmbientOutputRate(raw.outputFps)
      ? raw.outputFps
      : DEFAULT_AMBIENT_SETTINGS.outputFps,
    edgePriority:
      raw.edgePriority === "low" || raw.edgePriority === "medium"
        ? raw.edgePriority
        : DEFAULT_AMBIENT_SETTINGS.edgePriority,
    saturationBoost: clampRange(
      raw.saturationBoost,
      1.0,
      2.5,
      DEFAULT_AMBIENT_SETTINGS.saturationBoost
    ),
    brightnessBoost: clampRange(
      raw.brightnessBoost,
      1.0,
      2.0,
      DEFAULT_AMBIENT_SETTINGS.brightnessBoost
    ),
    responsiveness: clampRange(
      raw.responsiveness,
      0.0,
      1.0,
      DEFAULT_AMBIENT_SETTINGS.responsiveness
    ),
    minColorDelta: clampInt(
      raw.minColorDelta,
      0,
      50,
      DEFAULT_AMBIENT_SETTINGS.minColorDelta
    ),
    debug: typeof raw.debug === "boolean" ? raw.debug : DEFAULT_AMBIENT_SETTINGS.debug,
    brightnessMode:
      raw.brightnessMode === "manual" ? "manual" : DEFAULT_AMBIENT_SETTINGS.brightnessMode,
    brightnessResponse:
      raw.brightnessResponse === "balanced" || raw.brightnessResponse === "brighter"
        ? raw.brightnessResponse
        : DEFAULT_AMBIENT_SETTINGS.brightnessResponse,
    brightnessResponseFineTune: clampRange(
      raw.brightnessResponseFineTune,
      0.0,
      1.0,
      DEFAULT_AMBIENT_SETTINGS.brightnessResponseFineTune
    ),
    blackThreshold: clampRange(
      raw.blackThreshold,
      0.0,
      0.3,
      DEFAULT_AMBIENT_SETTINGS.blackThreshold
    ),
    minActiveBrightness,
    maxBrightness,
    brightnessSmoothing: clampRange(
      raw.brightnessSmoothing,
      0.05,
      0.6,
      DEFAULT_AMBIENT_SETTINGS.brightnessSmoothing
    ),
    centerContribution: clampRange(
      raw.centerContribution,
      0.0,
      0.35,
      DEFAULT_AMBIENT_SETTINGS.centerContribution
    ),
    highlightInfluence: clampRange(
      raw.highlightInfluence,
      0.0,
      1.0,
      DEFAULT_AMBIENT_SETTINGS.highlightInfluence
    ),
  };
}

import type { LampLoop, LoopStep } from "./types";
import { rgbToHex } from "./colorUtils";

export function loopTotalDurationMs(loop: LampLoop): number {
  if (loop.steps.length === 0) return 0;
  return loop.steps.reduce((sum, step) => sum + step.holdMs + step.transitionToNextMs, 0);
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 100) / 10;
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s` : `${secs}s`;
}

export function loopTimelineGradient(loop: LampLoop): string {
  if (loop.steps.length === 0) return "#333";
  const colors = loop.steps.map((s) => rgbToHex(s.r, s.g, s.b));
  if (colors.length === 1) return colors[0];
  const stops = colors.map((c, i) => {
    const pct = (i / (colors.length - 1)) * 100;
    return `${c} ${pct}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function stepColorState(step: LoopStep) {
  return { r: step.r, g: step.g, b: step.b, brightness: step.brightness };
}

export function isValidLoop(loop: Pick<LampLoop, "name" | "steps">): string | null {
  if (!loop.name.trim()) return "Loop name is required.";
  if (loop.steps.length < 2) return "A loop needs at least 2 steps to run.";
  for (const s of loop.steps) {
    if (s.r < 0 || s.r > 255 || s.g < 0 || s.g > 255 || s.b < 0 || s.b > 255) {
      return "RGB values must be 0–255.";
    }
    if (s.brightness < 0 || s.brightness > 64) return "Brightness must be 0–64.";
    if (s.holdMs < 0 || !Number.isFinite(s.holdMs)) return "Hold duration must be valid.";
    if (s.transitionToNextMs < 0 || !Number.isFinite(s.transitionToNextMs)) {
      return "Transition duration must be valid.";
    }
  }
  return null;
}

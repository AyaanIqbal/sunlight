import { throttledSetColor } from "./lampApi";

export interface ColorState {
  r: number;
  g: number;
  b: number;
  brightness: number;
}

let rafId: number | null = null;

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function lerp(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

export function cancelTransition(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function animateColorTransition(
  from: ColorState,
  to: ColorState,
  durationMs: number,
  onStep: (color: ColorState) => void,
  options?: { sendToLamp?: boolean; onComplete?: () => void }
): void {
  cancelTransition();

  const sendToLamp = options?.sendToLamp ?? true;
  const onComplete = options?.onComplete;
  const start = performance.now();

  const tick = (now: number) => {
    const elapsed = now - start;
    const rawT = durationMs <= 0 ? 1 : Math.min(elapsed / durationMs, 1);
    const t = easeOutQuad(rawT);

    const color: ColorState = {
      r: lerp(from.r, to.r, t),
      g: lerp(from.g, to.g, t),
      b: lerp(from.b, to.b, t),
      brightness: lerp(from.brightness, to.brightness, t),
    };

    onStep(color);

    if (sendToLamp) {
      throttledSetColor(color.r, color.g, color.b, color.brightness);
    }

    if (rawT < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      onStep(to);
      if (sendToLamp) {
        throttledSetColor(to.r, to.g, to.b, to.brightness);
      }
      onComplete?.();
    }
  };

  rafId = requestAnimationFrame(tick);
}

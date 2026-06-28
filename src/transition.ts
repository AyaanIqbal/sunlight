import { throttledSetColor } from "./lampApi";

export interface ColorState {
  r: number;
  g: number;
  b: number;
  brightness: number;
}

const TRANSITION_SEND_INTERVAL_MS = 45;

let rafId: number | null = null;

/** Smooth S-curve — gentle start and end, best for color fades. */
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function lerp(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

function colorsEqual(a: ColorState, b: ColorState): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.brightness === b.brightness;
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
  let lastSent: ColorState | null = null;

  const sendIfChanged = (color: ColorState, force = false) => {
    if (!sendToLamp) return;
    if (force || !lastSent || !colorsEqual(lastSent, color)) {
      lastSent = color;
      throttledSetColor(color.r, color.g, color.b, color.brightness, TRANSITION_SEND_INTERVAL_MS);
    }
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    const rawT = durationMs <= 0 ? 1 : Math.min(elapsed / durationMs, 1);
    const t = easeInOutSine(rawT);

    const color: ColorState = {
      r: lerp(from.r, to.r, t),
      g: lerp(from.g, to.g, t),
      b: lerp(from.b, to.b, t),
      brightness: lerp(from.brightness, to.brightness, t),
    };

    onStep(color);
    sendIfChanged(color);

    if (rawT < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      onStep(to);
      sendIfChanged(to, true);
      onComplete?.();
    }
  };

  rafId = requestAnimationFrame(tick);
}

import type { LampLoop, LoopStep } from "./types";
import { canSend, safeSetColor } from "./connectionManager";
import { animateColorTransition, cancelTransition, type ColorState } from "./transition";

export type LoopStopReason =
  | "user"
  | "manual_color"
  | "preset"
  | "another_loop"
  | "disconnect"
  | "connection_lost"
  | "import"
  | "reset"
  | "deleted"
  | "edited";

interface LoopRunnerCallbacks {
  onColorChange: (color: ColorState) => void;
  onRunningChange: (loopId: string | null, loopName?: string) => void;
  onStopped?: (reason: LoopStopReason) => void;
  getConnected: () => boolean;
}

let callbacks: LoopRunnerCallbacks | null = null;
let activeLoopId: string | null = null;
let activeLoop: LampLoop | null = null;
let cancelled = false;
let running = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (cancelled) {
      clearTimeout(t);
      resolve();
    }
  });
}

function animateTransition(
  from: ColorState,
  to: ColorState,
  durationMs: number
): Promise<void> {
  if (durationMs <= 0 || !callbacks) {
    callbacks?.onColorChange(to);
    if (callbacks?.getConnected()) void safeSetColor(to.r, to.g, to.b, to.brightness);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    animateColorTransition(from, to, durationMs, (color) => {
      callbacks?.onColorChange(color);
    }, {
      sendToLamp: callbacks?.getConnected() ?? false,
      canSend,
      onComplete: resolve,
    });
  });
}

async function applyStepColor(step: LoopStep): Promise<boolean> {
  if (!callbacks) return false;
  const color = { r: step.r, g: step.g, b: step.b, brightness: step.brightness };
  callbacks.onColorChange(color);
  if (!callbacks.getConnected()) return false;
  const result = await safeSetColor(step.r, step.g, step.b, step.brightness);
  return result.sent;
}

async function runLoop(): Promise<void> {
  let stepIndex = 0;

  while (!cancelled && activeLoop) {
    if (!callbacks?.getConnected()) {
      stopLoop("disconnect");
      return;
    }

    const step = activeLoop.steps[stepIndex];
    const sent = await applyStepColor(step);
    if (!sent && callbacks?.getConnected() === false) {
      stopLoop("connection_lost");
      return;
    }

    await sleep(step.holdMs);
    if (cancelled) break;

    const nextIndex = (stepIndex + 1) % activeLoop.steps.length;
    const nextStep = activeLoop.steps[nextIndex];
    const from = { r: step.r, g: step.g, b: step.b, brightness: step.brightness };
    const to = { r: nextStep.r, g: nextStep.g, b: nextStep.b, brightness: nextStep.brightness };

    if (step.transitionType === "instant" || step.transitionToNextMs <= 0) {
      await applyStepColor(nextStep);
    } else {
      await animateTransition(from, to, step.transitionToNextMs);
      if (cancelled) break;
      if (callbacks?.getConnected()) {
        const result = await safeSetColor(to.r, to.g, to.b, to.brightness);
        if (!result.sent && !callbacks.getConnected()) {
          stopLoop("connection_lost");
          return;
        }
      }
    }

    stepIndex = nextIndex;
  }
}

export function initLoopRunner(cbs: LoopRunnerCallbacks): void {
  callbacks = cbs;
}

export function getActiveLoopId(): string | null {
  return activeLoopId;
}

export function isLoopRunning(): boolean {
  return running;
}

export function startLoop(loop: LampLoop): { ok: true } | { ok: false; error: string } {
  if (!callbacks) return { ok: false, error: "Loop runner not initialized." };
  if (loop.steps.length < 2) {
    return { ok: false, error: "A loop needs at least 2 steps to run." };
  }
  if (!callbacks.getConnected()) {
    return { ok: false, error: "Connect to the lamp before running a loop." };
  }

  stopLoop("another_loop");

  cancelled = false;
  running = true;
  activeLoopId = loop.id;
  activeLoop = loop;
  callbacks.onRunningChange(loop.id, loop.name);

  void runLoop().finally(() => {
    if (activeLoopId === loop.id) {
      running = false;
      activeLoopId = null;
      activeLoop = null;
      callbacks?.onRunningChange(null);
    }
  });

  return { ok: true };
}

export function stopLoop(reason: LoopStopReason = "user"): void {
  if (!running && !activeLoopId) return;
  cancelled = true;
  running = false;
  cancelTransition();
  const prevId = activeLoopId;
  activeLoopId = null;
  activeLoop = null;
  if (prevId) {
    callbacks?.onRunningChange(null);
    callbacks?.onStopped?.(reason);
  }
}

export function previewStepColor(step: LoopStep): Promise<{ sent: boolean }> {
  if (!callbacks) return Promise.resolve({ sent: false });
  const color = { r: step.r, g: step.g, b: step.b, brightness: step.brightness };
  callbacks.onColorChange(color);
  return safeSetColor(step.r, step.g, step.b, step.brightness);
}

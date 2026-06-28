import type { AmbientFrameEvent, AmbientSettings, AmbientStatus } from "./types";
import {
  ambientGetStatus,
  ambientStart,
  ambientStop,
  ambientUpdateSettings,
  listenAmbientFrame,
  listenAmbientNotice,
  listenAmbientStatus,
  listenAmbientStopped,
  type AmbientStopReason,
  type AmbientStoppedEvent,
} from "./ambientApi";

export interface PreAmbientState {
  r: number;
  g: number;
  b: number;
  brightness: number;
}

interface AmbientRunnerCallbacks {
  onColorChange: (color: { r: number; g: number; b: number }) => void;
  onStatusChange: (status: AmbientStatus) => void;
  onFrameMetrics?: (frame: AmbientFrameEvent) => void;
  onStopped?: (reason: AmbientStopReason, message?: string) => void;
  onNotice?: (message: string) => void;
  getConnected: () => boolean;
  capturePreAmbientState?: () => PreAmbientState;
  onRestorePreAmbient?: (state: PreAmbientState) => void;
}

let callbacks: AmbientRunnerCallbacks | null = null;
let running = false;
let stopping = false;
let listenersReady = false;
let unlisteners: Array<() => void> = [];
let preAmbientState: PreAmbientState | null = null;

function isActiveAmbientStatus(status: AmbientStatus): boolean {
  return status === "running" || status === "starting_capture";
}

export function initAmbientRunner(cbs: AmbientRunnerCallbacks): void {
  callbacks = cbs;
  void setupListeners();
}

async function setupListeners(): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;

  const unsubs = await Promise.all([
    listenAmbientFrame((frame) => {
      if (!running || stopping) return;
      callbacks?.onColorChange({ r: frame.r, g: frame.g, b: frame.b });
      callbacks?.onFrameMetrics?.(frame);
    }),
    listenAmbientStatus((status) => {
      if (stopping || (!running && isActiveAmbientStatus(status))) return;
      running = isActiveAmbientStatus(status);
      callbacks?.onStatusChange(status);
      if (status === "stopped" || status === "inactive" || status === "failed") {
        running = false;
      }
    }),
    listenAmbientStopped((event: AmbientStoppedEvent) => {
      if (stopping) return;
      running = false;
      callbacks?.onStatusChange("stopped");
      if (event.reason !== "user") {
        preAmbientState = null;
      }
      callbacks?.onStopped?.(event.reason, event.message);
    }),
    listenAmbientNotice((message) => {
      callbacks?.onNotice?.(message);
    }),
  ]);

  unlisteners = unsubs;
}

export function isAmbientRunning(): boolean {
  return running && !stopping;
}

export async function startAmbient(
  settings: AmbientSettings,
  brightness: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!callbacks) return { ok: false, error: "Ambient runner not initialized." };
  if (!callbacks.getConnected()) {
    return { ok: false, error: "Connect to SSL-99A4C3 before starting Ambient Mode." };
  }

  stopping = false;

  try {
    await ambientStart(settings, brightness);
    preAmbientState = callbacks.capturePreAmbientState?.() ?? null;
    running = true;
    return { ok: true };
  } catch (e: unknown) {
    running = false;
    stopping = false;
    preAmbientState = null;
    callbacks.onStatusChange("failed");
    const message =
      typeof e === "string"
        ? e
        : "Could not start Ambient Mode. Check Screen Recording permission and try again.";
    return { ok: false, error: message };
  }
}

export async function stopAmbient(reason: AmbientStopReason = "user"): Promise<void> {
  stopping = true;
  running = false;
  callbacks?.onStatusChange("stopped");

  try {
    await ambientStop();
  } catch {
    // ignore stop errors
  } finally {
    stopping = false;
  }

  if (reason === "user" && preAmbientState && callbacks?.onRestorePreAmbient) {
    callbacks.onRestorePreAmbient(preAmbientState);
  }
  preAmbientState = null;
}

export function updateAmbientSettings(
  settings: AmbientSettings,
  brightness?: number
): void {
  if (!running || stopping) return;
  void ambientUpdateSettings(settings, brightness).catch(() => {});
}

export async function syncAmbientStatus(): Promise<AmbientStatus> {
  const status = await ambientGetStatus();
  if (!stopping) {
    running = isActiveAmbientStatus(status);
    callbacks?.onStatusChange(status);
  }
  return status;
}

export function teardownAmbientRunner(): void {
  for (const unlisten of unlisteners) unlisten();
  unlisteners = [];
  listenersReady = false;
  running = false;
  stopping = false;
  preAmbientState = null;
}

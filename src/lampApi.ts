import { invoke } from "@tauri-apps/api/core";
import type { ConnectionStatus } from "./types";

export async function connectLamp(): Promise<void> {
  await invoke("connect_lamp");
}

export async function disconnectLamp(): Promise<void> {
  await invoke("disconnect_lamp");
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return await invoke<ConnectionStatus>("get_connection_status");
}

export async function setColor(
  r: number,
  g: number,
  b: number,
  brightness: number
): Promise<void> {
  await invoke("set_color", { r, g, b, brightness });
}

export async function reconnectLamp(): Promise<void> {
  await invoke("reconnect_lamp");
}

interface PendingColor {
  r: number;
  g: number;
  b: number;
  brightness: number;
}

let throttleTimer: ReturnType<typeof setTimeout> | null = null;
let lastSendTime = 0;
let pending: PendingColor | null = null;

async function sendColor(r: number, g: number, b: number, brightness: number): Promise<void> {
  try {
    await setColor(r, g, b, brightness);
  } catch {
    // Swallow; the UI handles connection state separately
  }
}

/** Leading + trailing throttle — fires immediately, then at most once per interval during drag, with a final trailing send. */
export function throttledSetColor(
  r: number,
  g: number,
  b: number,
  brightness: number,
  interval = 100
): void {
  const now = Date.now();
  pending = { r, g, b, brightness };

  if (now - lastSendTime >= interval) {
    lastSendTime = now;
    pending = null;
    void sendColor(r, g, b, brightness);
    return;
  }

  if (throttleTimer) return;

  const remaining = interval - (now - lastSendTime);
  throttleTimer = setTimeout(() => {
    throttleTimer = null;
    if (pending) {
      lastSendTime = Date.now();
      const { r: pr, g: pg, b: pb, brightness: pbr } = pending;
      pending = null;
      void sendColor(pr, pg, pb, pbr);
    }
  }, remaining);
}

/** @deprecated Use throttledSetColor */
export function debouncedSetColor(
  r: number,
  g: number,
  b: number,
  brightness: number,
  delay = 0
): void {
  if (delay <= 0) {
    void sendColor(r, g, b, brightness);
    return;
  }
  throttledSetColor(r, g, b, brightness, delay);
}

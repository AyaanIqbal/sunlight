import { invoke } from "@tauri-apps/api/core";
import type { ConnectionStatus } from "./types";

export async function connectLamp(): Promise<void> {
  await invoke("connect_lamp");
}

export async function disconnectLamp(): Promise<void> {
  await invoke("disconnect_lamp");
}

export async function reconnectLamp(): Promise<void> {
  await invoke("reconnect_lamp");
}

export async function refreshBluetooth(): Promise<void> {
  await invoke("refresh_bluetooth");
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return await invoke<ConnectionStatus>("get_connection_status");
}

export async function verifyConnection(): Promise<ConnectionStatus> {
  return await invoke<ConnectionStatus>("verify_connection");
}

export async function setColor(
  r: number,
  g: number,
  b: number,
  brightness: number
): Promise<void> {
  await invoke("set_color", { r, g, b, brightness });
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

type SendColorFn = (
  r: number,
  g: number,
  b: number,
  brightness: number
) => Promise<{ sent: boolean }>;

let sendColorImpl: SendColorFn = async (r, g, b, brightness) => {
  try {
    await setColor(r, g, b, brightness);
    return { sent: true };
  } catch {
    return { sent: false };
  }
};

export function setSendColorImpl(fn: SendColorFn): void {
  sendColorImpl = fn;
}

export function clearThrottledSends(): void {
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
  pending = null;
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
    void sendColorImpl(r, g, b, brightness);
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
      void sendColorImpl(pr, pg, pb, pbr);
    }
  }, remaining);
}

export function canSendToLamp(): boolean {
  return sendColorImpl !== null;
}

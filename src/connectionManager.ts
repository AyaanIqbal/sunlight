import type { ConnectionStatus } from "./types";
import {
  clearThrottledSends,
  getConnectionStatus,
  reconnectLamp,
  refreshBluetooth as refreshBluetoothApi,
  setSendColorImpl,
  setColor,
  verifyConnection,
} from "./lampApi";
import { cancelTransition } from "./transition";

interface ConnectionManagerConfig {
  getStatus: () => ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  getAutoConnect: () => boolean;
}

let config: ConnectionManagerConfig | null = null;

export function initConnectionManager(cfg: ConnectionManagerConfig): void {
  config = cfg;

  setSendColorImpl(async (r, g, b, brightness) => {
    if (!config) return { sent: false };
    if (config.getStatus() !== "connected") {
      return { sent: false };
    }

    try {
      await setColor(r, g, b, brightness);
      return { sent: true };
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : "Failed to send color to the lamp.";
      onConnectionLost(message);
      return { sent: false };
    }
  });
}

export function isConnected(): boolean {
  return config?.getStatus() === "connected";
}

export async function safeSetColor(
  r: number,
  g: number,
  b: number,
  brightness: number
): Promise<{ sent: boolean }> {
  if (!config || config.getStatus() !== "connected") {
    return { sent: false };
  }

  try {
    await setColor(r, g, b, brightness);
    return { sent: true };
  } catch (e: unknown) {
    const message = typeof e === "string" ? e : "Failed to send color to the lamp.";
    onConnectionLost(message);
    return { sent: false };
  }
}

export function onConnectionLost(errorMessage?: string): void {
  cancelTransition();
  clearThrottledSends();
  if (!config) return;

  void getConnectionStatus()
    .then((status) => {
      if (config) config.setStatus(status);
    })
    .catch(() => {
      if (config) config.setStatus("stale");
    });

  if (errorMessage) {
    config.setError(errorMessage);
  }
}

export async function refreshBluetooth(): Promise<void> {
  if (!config) return;
  config.setError(null);
  config.setStatus("scanning");
  try {
    await refreshBluetoothApi();
    const latest = await getConnectionStatus();
    config.setStatus(latest);
  } catch (e: unknown) {
    config.setStatus("failed");
    config.setError(formatConnectionError(e));
  }
}

export async function verifyOnResume(): Promise<void> {
  if (!config) return;

  const current = config.getStatus();
  if (current === "scanning" || current === "connecting" || current === "reconnecting") {
    return;
  }

  try {
    const status = await verifyConnection();
    config.setStatus(status);

    if (status === "stale" && config.getAutoConnect()) {
      config.setStatus("reconnecting");
      try {
        await reconnectLamp();
        config.setStatus("connected");
      } catch (e: unknown) {
        const latest = await getConnectionStatus();
        config.setStatus(latest === "connected" ? "connected" : "failed");
        config.setError(formatConnectionError(e));
      }
    }
  } catch {
    // ignore verify errors
  }
}

export function formatConnectionError(e: unknown): string {
  if (typeof e === "string") return e;
  return "Could not connect to SSL-99A4C3. Make sure the lamp is on and the iStrip app is closed.";
}

export function canSend(): boolean {
  return config?.getStatus() === "connected";
}

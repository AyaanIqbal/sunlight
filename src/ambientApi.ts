import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AmbientDebugMetrics, AmbientFrameEvent, AmbientSettings, AmbientStatus } from "./types";

export type ScreenCapturePermission = "granted" | "denied" | "unknown";

export type AmbientStopReason =
  | "user"
  | "manual_color"
  | "preset"
  | "loop"
  | "disconnect"
  | "connection_lost"
  | "import"
  | "reset"
  | "permission"
  | "capture_failed"
  | "performance";

export interface AmbientStoppedEvent {
  reason: AmbientStopReason;
  message?: string;
}

export async function ambientCheckPermission(): Promise<ScreenCapturePermission> {
  return invoke<ScreenCapturePermission>("ambient_check_permission");
}

export async function ambientRequestPermission(): Promise<ScreenCapturePermission> {
  return invoke<ScreenCapturePermission>("ambient_request_permission");
}

export async function ambientGetStatus(): Promise<AmbientStatus> {
  return invoke<AmbientStatus>("ambient_get_status");
}

export async function ambientStart(
  settings: AmbientSettings,
  brightness: number
): Promise<void> {
  return invoke("ambient_start", { settings, brightness });
}

export async function ambientStop(): Promise<void> {
  return invoke("ambient_stop");
}

export async function ambientUpdateSettings(
  settings: AmbientSettings,
  brightness?: number
): Promise<void> {
  return invoke("ambient_update_settings", { settings, brightness });
}

export async function listenAmbientFrame(
  handler: (event: AmbientFrameEvent) => void
): Promise<UnlistenFn> {
  return listen<AmbientFrameEvent>("ambient://frame", (e) => handler(e.payload));
}

export async function listenAmbientDebugMetrics(
  handler: (metrics: AmbientDebugMetrics) => void
): Promise<UnlistenFn> {
  return listen<AmbientDebugMetrics>("ambient://debug-metrics", (e) =>
    handler(e.payload)
  );
}

export async function listenAmbientStatus(
  handler: (status: AmbientStatus) => void
): Promise<UnlistenFn> {
  return listen<{ status: AmbientStatus }>("ambient://status", (e) =>
    handler(e.payload.status)
  );
}

export async function listenAmbientStopped(
  handler: (event: AmbientStoppedEvent) => void
): Promise<UnlistenFn> {
  return listen<AmbientStoppedEvent>("ambient://stopped", (e) => handler(e.payload));
}

export async function listenAmbientNotice(
  handler: (message: string) => void
): Promise<UnlistenFn> {
  return listen<{ message: string }>("ambient://notice", (e) =>
    handler(e.payload.message)
  );
}

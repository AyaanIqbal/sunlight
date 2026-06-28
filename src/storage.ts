import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "./types";
import { migrateAppState } from "./migrateState";

export async function loadAppState(): Promise<AppState | null> {
  try {
    const raw = await invoke<AppState | null>("load_state");
    if (!raw) return null;
    return migrateAppState(raw);
  } catch {
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await invoke("save_state", { state: { ...state, schemaVersion: 2 } });
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}

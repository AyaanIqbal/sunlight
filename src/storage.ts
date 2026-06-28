import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "./types";

export async function loadAppState(): Promise<AppState | null> {
  try {
    return await invoke<AppState | null>("load_state");
  } catch {
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await invoke("save_state", { state });
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}

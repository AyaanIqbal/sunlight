import type { AppState } from "./types";
import { DEFAULT_AMBIENT_SETTINGS } from "./types";
import { mergeAmbientSettings } from "./ambientDefaults";
import { seedDefaults } from "./presets";
import { seedLoopDefaults, ensureDefaultLoopSections } from "./loops";

export const CURRENT_SCHEMA_VERSION = 2;

export function migrateAppState(raw: Partial<AppState> | null): AppState | null {
  if (!raw || !raw.settings) return null;

  const needsLoopMigration = raw.loops === undefined && raw.loopSections === undefined;
  const { loops: defaultLoops, loopSections: defaultLoopSections } = seedLoopDefaults();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      deviceName: raw.settings.deviceName ?? "SSL-99A4C3",
      autoConnect: raw.settings.autoConnect ?? false,
      liveUpdate: raw.settings.liveUpdate ?? true,
      transitionEnabled: raw.settings.transitionEnabled ?? true,
      transitionDurationMs: raw.settings.transitionDurationMs ?? 1200,
      activeWorkspace: raw.settings.activeWorkspace ?? "presets",
      ambient: mergeAmbientSettings(raw.settings.ambient),
      lastColor: raw.settings.lastColor ?? { r: 255, g: 128, b: 0, brightness: 64 },
    },
    sections: raw.sections ?? [],
    presets: raw.presets ?? [],
    loops: needsLoopMigration ? defaultLoops : (raw.loops ?? []),
    loopSections: needsLoopMigration
      ? defaultLoopSections
      : ensureDefaultLoopSections(raw.loopSections ?? []),
  };
}

export function createFreshAppState(): AppState {
  const { presets, sections } = seedDefaults();
  const { loops, loopSections } = seedLoopDefaults();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      deviceName: "SSL-99A4C3",
      autoConnect: false,
      liveUpdate: true,
      transitionEnabled: true,
      transitionDurationMs: 1200,
      activeWorkspace: "presets",
      ambient: DEFAULT_AMBIENT_SETTINGS,
      lastColor: { r: 255, g: 128, b: 0, brightness: 64 },
    },
    sections,
    presets,
    loops,
    loopSections,
  };
}

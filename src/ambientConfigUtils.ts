import { v4 as uuidv4 } from "uuid";
import { mergeAmbientSettings, isAdaptiveMax } from "./ambientDefaults";
import {
  MOVIE_AMBIENT_SETTINGS,
  type AmbientConfig,
  type AmbientQuality,
  type AmbientSettings,
} from "./types";

export const MOVIE_AMBIENT_CONFIG_ID = "00000000-0000-4000-a000-000000000001";
export const MOVIE_AMBIENT_CONFIG_NAME = "Movie";

const QUALITY_LABELS: Record<AmbientQuality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  responsive_detail: "Responsive Detail",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ambientSettingsEqual(a: AmbientSettings, b: AmbientSettings): boolean {
  return (
    a.quality === b.quality &&
    a.outputFps === b.outputFps &&
    a.edgePriority === b.edgePriority &&
    a.saturationBoost === b.saturationBoost &&
    a.brightnessBoost === b.brightnessBoost &&
    a.responsiveness === b.responsiveness &&
    a.minColorDelta === b.minColorDelta &&
    a.debug === b.debug &&
    a.brightnessMode === b.brightnessMode &&
    a.brightnessResponse === b.brightnessResponse &&
    a.brightnessResponseFineTune === b.brightnessResponseFineTune &&
    a.blackThreshold === b.blackThreshold &&
    a.minActiveBrightness === b.minActiveBrightness &&
    a.maxBrightness === b.maxBrightness &&
    a.brightnessSmoothing === b.brightnessSmoothing &&
    a.centerContribution === b.centerContribution &&
    a.highlightInfluence === b.highlightInfluence
  );
}

export function formatConfigSummary(settings: AmbientSettings): string {
  const quality = QUALITY_LABELS[settings.quality];
  const mode =
    settings.brightnessMode === "dynamic"
      ? "Dynamic"
      : "Manual";
  const rate = isAdaptiveMax(settings.outputFps)
    ? "Adaptive Max"
    : `${settings.outputFps} FPS`;
  return `${quality} · ${rate} · ${mode} · Black ${settings.blackThreshold.toFixed(2)}`;
}

export function parseAmbientConfig(raw: unknown): AmbientConfig | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;

  const now = new Date().toISOString();
  const settings = mergeAmbientSettings(
    isRecord(raw.settings) ? (raw.settings as Partial<AmbientSettings>) : undefined
  );

  return {
    id: raw.id,
    name: raw.name.trim() || "Untitled Config",
    settings,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export function normalizeConfigOrder(
  configs: AmbientConfig[],
  order: string[]
): { configs: AmbientConfig[]; order: string[] } {
  const configMap = new Map(configs.map((c) => [c.id, c]));
  const normalizedOrder: string[] = [];

  for (const id of order) {
    if (configMap.has(id) && !normalizedOrder.includes(id)) {
      normalizedOrder.push(id);
    }
  }

  for (const config of configs) {
    if (!normalizedOrder.includes(config.id)) {
      normalizedOrder.push(config.id);
    }
  }

  return {
    configs: normalizedOrder
      .map((id) => configMap.get(id))
      .filter((c): c is AmbientConfig => c != null),
    order: normalizedOrder,
  };
}

function makeBundledAmbientConfig(
  id: string,
  name: string,
  settings: AmbientSettings
): AmbientConfig {
  const now = new Date().toISOString();
  return {
    id,
    name,
    settings: mergeAmbientSettings(settings),
    createdAt: now,
    updatedAt: now,
  };
}

export function createMovieAmbientConfig(): AmbientConfig {
  return makeBundledAmbientConfig(
    MOVIE_AMBIENT_CONFIG_ID,
    MOVIE_AMBIENT_CONFIG_NAME,
    MOVIE_AMBIENT_SETTINGS
  );
}

export function seedAmbientDefaults(): { configs: AmbientConfig[]; order: string[] } {
  const movie = createMovieAmbientConfig();
  return { configs: [movie], order: [movie.id] };
}

export function ensureDefaultAmbientConfigs(
  configs: AmbientConfig[],
  order: string[]
): { configs: AmbientConfig[]; order: string[] } {
  const hasMovie = configs.some(
    (c) => c.id === MOVIE_AMBIENT_CONFIG_ID || c.name === MOVIE_AMBIENT_CONFIG_NAME
  );
  if (hasMovie) {
    return normalizeConfigOrder(configs, order);
  }

  const movie = createMovieAmbientConfig();
  return normalizeConfigOrder([movie, ...configs], [movie.id, ...order]);
}

export function migrateAmbientConfigs(
  rawConfigs: unknown,
  rawOrder: unknown
): { configs: AmbientConfig[]; order: string[] } {
  const configs = Array.isArray(rawConfigs)
    ? rawConfigs.map(parseAmbientConfig).filter((c): c is AmbientConfig => c !== null)
    : [];
  const order = Array.isArray(rawOrder)
    ? rawOrder.filter((id): id is string => typeof id === "string")
    : [];
  return ensureDefaultAmbientConfigs(configs, order);
}

export function createAmbientConfig(name: string, settings: AmbientSettings): AmbientConfig {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: name.trim(),
    settings: mergeAmbientSettings(settings),
    createdAt: now,
    updatedAt: now,
  };
}

export function dedupeAmbientConfigIds(configs: AmbientConfig[]): AmbientConfig[] {
  const seen = new Set<string>();
  return configs.map((config) => {
    if (!seen.has(config.id)) {
      seen.add(config.id);
      return config;
    }
    const next = { ...config, id: uuidv4() };
    seen.add(next.id);
    return next;
  });
}

export function findActiveConfig(
  configs: AmbientConfig[],
  settings: AmbientSettings
): AmbientConfig | null {
  return configs.find((c) => ambientSettingsEqual(c.settings, settings)) ?? null;
}

import { v4 as uuidv4 } from "uuid";
import type { LampPreset, PresetSection } from "./types";
import { defaultGradient, rgbToHex } from "./colorUtils";

function presetDef(
  name: string,
  r: number,
  g: number,
  b: number,
  brightness = 64
): Omit<LampPreset, "id" | "createdAt" | "updatedAt"> {
  return { name, r, g, b, brightness, gradient: defaultGradient(r, g, b) };
}

const MY_PRESET_DEFS = [
  presetDef("Intense Red", 255, 17, 0),
  presetDef("Orange Sunset", 255, 128, 0),
  presetDef("Ocean Blue-Green", 0, 255, 255),
];

const BASIC_COLOUR_DEFS = [
  presetDef("Blue", 0, 0, 255),
  presetDef("Red", 255, 0, 0),
  presetDef("Green", 0, 255, 0),
  presetDef("Pink", 255, 0, 255),
];

export const DEFAULT_PRESETS: Omit<LampPreset, "id" | "createdAt" | "updatedAt">[] = [
  ...MY_PRESET_DEFS,
  ...BASIC_COLOUR_DEFS,
];

export function makePreset(
  fields: Omit<LampPreset, "id" | "createdAt" | "updatedAt">
): LampPreset {
  const now = new Date().toISOString();
  return { ...fields, id: uuidv4(), createdAt: now, updatedAt: now };
}

export function makeSection(name: string): PresetSection {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    collapsed: false,
    presetIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function seedDefaults(): { presets: LampPreset[]; sections: PresetSection[] } {
  const myPresets = MY_PRESET_DEFS.map((p) => makePreset(p));
  const basicPresets = BASIC_COLOUR_DEFS.map((p) => makePreset(p));

  const mySection = makeSection("My Presets");
  mySection.presetIds = myPresets.map((p) => p.id);

  const basicSection = makeSection("Basic Colours");
  basicSection.presetIds = basicPresets.map((p) => p.id);

  return {
    presets: [...myPresets, ...basicPresets],
    sections: [mySection, basicSection],
  };
}

export function gradientStyle(preset: LampPreset): string {
  const { borderColor, mainColor, middleColor } = preset.gradient ?? {
    borderColor: rgbToHex(preset.r, preset.g, preset.b),
    mainColor: rgbToHex(preset.r, preset.g, preset.b),
    middleColor: rgbToHex(preset.r, preset.g, preset.b),
  };
  return `linear-gradient(90deg, ${borderColor}, ${mainColor}, ${middleColor})`;
}

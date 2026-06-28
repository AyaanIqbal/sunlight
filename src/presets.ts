import { v4 as uuidv4 } from "uuid";
import type { LampPreset, PresetSection } from "./types";
import { rgbToHex } from "./colorUtils";

export const DEFAULT_PRESETS: Omit<LampPreset, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Orange Sunset",
    r: 255, g: 128, b: 0, brightness: 64,
    gradient: { borderColor: "#FFB000", mainColor: "#FF8000", middleColor: "#FF4A00" },
  },
  {
    name: "Dark Orange",
    r: 255, g: 80, b: 10, brightness: 64,
    gradient: { borderColor: "#FF7A1A", mainColor: "#FF500A", middleColor: "#D93A00" },
  },
  {
    name: "Reddish Orange",
    r: 255, g: 40, b: 0, brightness: 64,
    gradient: { borderColor: "#FF5A00", mainColor: "#FF2800", middleColor: "#CC1F00" },
  },
  {
    name: "Red",
    r: 255, g: 0, b: 0, brightness: 64,
    gradient: { borderColor: "#FF0000", mainColor: "#FF0000", middleColor: "#FF0000" },
  },
  {
    name: "Pink Purple",
    r: 255, g: 0, b: 255, brightness: 64,
    gradient: { borderColor: "#FF7AFF", mainColor: "#FF00FF", middleColor: "#A000FF" },
  },
  {
    name: "Blue Green Border",
    r: 0, g: 255, b: 255, brightness: 64,
    gradient: { borderColor: "#00FFAA", mainColor: "#00D5FF", middleColor: "#008CFF" },
  },
  {
    name: "Pink Yellow Border",
    r: 255, g: 255, b: 255, brightness: 64,
    gradient: { borderColor: "#FFE066", mainColor: "#FFB3D9", middleColor: "#FFD1E8" },
  },
  {
    name: "Green",
    r: 0, g: 255, b: 0, brightness: 64,
    gradient: { borderColor: "#00FF00", mainColor: "#00FF00", middleColor: "#00FF00" },
  },
  {
    name: "Blue",
    r: 0, g: 0, b: 255, brightness: 64,
    gradient: { borderColor: "#0000FF", mainColor: "#0000FF", middleColor: "#0000FF" },
  },
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
  const presets = DEFAULT_PRESETS.map((p) => makePreset(p));
  const section = makeSection("My Presets");
  section.presetIds = presets.map((p) => p.id);
  return { presets, sections: [section] };
}

export function gradientStyle(preset: LampPreset): string {
  const { borderColor, mainColor, middleColor } = preset.gradient ?? {
    borderColor: rgbToHex(preset.r, preset.g, preset.b),
    mainColor: rgbToHex(preset.r, preset.g, preset.b),
    middleColor: rgbToHex(preset.r, preset.g, preset.b),
  };
  return `linear-gradient(90deg, ${borderColor}, ${mainColor}, ${middleColor})`;
}

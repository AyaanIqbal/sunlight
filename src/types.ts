export type ConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stale"
  | "failed";

export type WorkspaceTab = "presets" | "loops" | "ambient";

export type AmbientQuality = "performance" | "balanced" | "responsive_detail";
export type AmbientOutputFps = 4 | 8 | 10 | 12 | 15;
export type AmbientEdgePriority = "low" | "medium" | "high";
export type AmbientBrightnessMode = "manual" | "dynamic";
export type AmbientBrightnessResponse = "dimmer" | "balanced" | "brighter";

export type AmbientStatus =
  | "inactive"
  | "checking_permission"
  | "waiting_for_permission"
  | "starting_capture"
  | "running"
  | "stopped"
  | "failed";

export interface AmbientSettings {
  quality: AmbientQuality;
  outputFps: AmbientOutputFps;
  edgePriority: AmbientEdgePriority;
  saturationBoost: number;
  brightnessBoost: number;
  responsiveness: number;
  minColorDelta: number;
  debug: boolean;
  brightnessMode: AmbientBrightnessMode;
  brightnessResponse: AmbientBrightnessResponse;
  brightnessResponseFineTune: number;
  blackThreshold: number;
  minActiveBrightness: number;
  maxBrightness: number;
  brightnessSmoothing: number;
  centerContribution: number;
  highlightInfluence: number;
}

export const DEFAULT_AMBIENT_SETTINGS: AmbientSettings = {
  quality: "balanced",
  outputFps: 8,
  edgePriority: "high",
  saturationBoost: 1.4,
  brightnessBoost: 1.15,
  responsiveness: 0.5,
  minColorDelta: 10,
  debug: false,
  brightnessMode: "dynamic",
  brightnessResponse: "dimmer",
  brightnessResponseFineTune: 0.5,
  blackThreshold: 0.06,
  minActiveBrightness: 4,
  maxBrightness: 64,
  brightnessSmoothing: 0.22,
  centerContribution: 0.15,
  highlightInfluence: 0.3,
};

export interface AmbientFrameEvent {
  r: number;
  g: number;
  b: number;
  hex: string;
  computedBrightness?: number;
  targetBrightness?: number;
  smoothedBrightness?: number;
  edgeIntensity?: number;
  centerIntensity?: number;
  spatialIntensity?: number;
  highlightIntensity?: number;
  screenIntensity?: number;
  brightnessMode?: AmbientBrightnessMode;
  blackThreshold?: number;
  centerContribution?: number;
  highlightInfluence?: number;
  sampleFps?: number;
  outputFps?: number;
  processingMs?: number;
  skippedSends?: number;
}
export type TransitionType = "smooth" | "instant";

export interface LampPreset {
  id: string;
  name: string;
  r: number;
  g: number;
  b: number;
  brightness: number;
  gradient?: {
    borderColor: string;
    mainColor: string;
    middleColor: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresetSection {
  id: string;
  name: string;
  collapsed: boolean;
  presetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LoopStep {
  id: string;
  name?: string;
  r: number;
  g: number;
  b: number;
  brightness: number;
  holdMs: number;
  transitionToNextMs: number;
  transitionType: TransitionType;
}

export interface LampLoop {
  id: string;
  name: string;
  steps: LoopStep[];
  notes?: string;
  sectionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoopSection {
  id: string;
  name: string;
  collapsed: boolean;
  loopIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  deviceName: string;
  autoConnect: boolean;
  liveUpdate: boolean;
  transitionEnabled: boolean;
  transitionDurationMs: number;
  activeWorkspace?: WorkspaceTab;
  ambient?: AmbientSettings;
  lastColor: {
    r: number;
    g: number;
    b: number;
    brightness: number;
  };
}

export interface AppState {
  schemaVersion?: number;
  settings: AppSettings;
  sections: PresetSection[];
  presets: LampPreset[];
  loopSections: LoopSection[];
  loops: LampLoop[];
}

export interface ExportBundle {
  schemaVersion: 2;
  exportedAt: string;
  app: "Sunset Lamp Controller";
  settings: AppSettings;
  sections: PresetSection[];
  presets: LampPreset[];
  loopSections: LoopSection[];
  loops: LampLoop[];
}

export type ConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stale"
  | "failed";

export type WorkspaceTab = "presets" | "loops";
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

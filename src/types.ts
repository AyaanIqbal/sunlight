export type ConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "failed";

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

export interface AppSettings {
  deviceName: string;
  autoConnect: boolean;
  liveUpdate: boolean;
  transitionEnabled: boolean;
  transitionDurationMs: number;
  lastColor: {
    r: number;
    g: number;
    b: number;
    brightness: number;
  };
}

export interface AppState {
  settings: AppSettings;
  sections: PresetSection[];
  presets: LampPreset[];
}

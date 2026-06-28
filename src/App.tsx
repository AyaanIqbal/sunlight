import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { AppState, ConnectionStatus, LampPreset, PresetSection } from "./types";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ColorControlPanel } from "./components/ColorControlPanel";
import { PresetPanel } from "./components/PresetPanel";
import { PresetEditorModal } from "./components/PresetEditorModal";
import { SettingsModal } from "./components/SettingsModal";
import { loadAppState, saveAppState } from "./storage";
import { seedDefaults } from "./presets";
import { connectLamp, setColor } from "./lampApi";
import { animateColorTransition, cancelTransition } from "./transition";

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState(255);
  const [g, setG] = useState(128);
  const [b, setB] = useState(0);
  const [brightness, setBrightness] = useState(64);
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [autoConnect, setAutoConnect] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [transitionDurationMs, setTransitionDurationMs] = useState(1200);
  const [presets, setPresets] = useState<LampPreset[]>([]);
  const [sections, setSections] = useState<PresetSection[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [saveCurrentModal, setSaveCurrentModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorRef = useRef({ r, g, b, brightness });
  const transitionSettingsRef = useRef({ transitionEnabled, transitionDurationMs });
  const statusRef = useRef(status);

  useEffect(() => {
    colorRef.current = { r, g, b, brightness };
  }, [r, g, b, brightness]);

  useEffect(() => {
    transitionSettingsRef.current = { transitionEnabled, transitionDurationMs };
  }, [transitionEnabled, transitionDurationMs]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      const state = await loadAppState();
      if (state) {
        setR(state.settings.lastColor.r);
        setG(state.settings.lastColor.g);
        setB(state.settings.lastColor.b);
        setBrightness(state.settings.lastColor.brightness);
        setLiveUpdate(state.settings.liveUpdate);
        setAutoConnect(state.settings.autoConnect);
        setTransitionEnabled(state.settings.transitionEnabled ?? true);
        setTransitionDurationMs(state.settings.transitionDurationMs ?? 1200);
        setPresets(state.presets);
        setSections(state.sections);

        if (state.settings.autoConnect) {
          try {
            await connectLamp();
            setStatus("connected");
          } catch {
            setStatus("failed");
          }
        }
      } else {
        const { presets: defaultPresets, sections: defaultSections } = seedDefaults();
        setPresets(defaultPresets);
        setSections(defaultSections);
      }
      setLoaded(true);
    })();
  }, []);

  // Debounced auto-save whenever state changes
  const doPersist = useCallback(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const state: AppState = {
        settings: {
          deviceName: "SSL-99A4C3",
          autoConnect,
          liveUpdate,
          transitionEnabled,
          transitionDurationMs,
          lastColor: { r, g, b, brightness },
        },
        sections,
        presets,
      };
      saveAppState(state);
    }, 500);
  }, [
    loaded,
    autoConnect,
    liveUpdate,
    transitionEnabled,
    transitionDurationMs,
    r,
    g,
    b,
    brightness,
    sections,
    presets,
  ]);

  useEffect(() => {
    doPersist();
  }, [doPersist]);

  const handleColorChange = (nr: number, ng: number, nb: number, nbr: number) => {
    cancelTransition();
    setR(nr);
    setG(ng);
    setB(nb);
    setBrightness(nbr);
    setActivePresetId(null);
  };

  const handleActivatePreset = (preset: LampPreset) => {
    cancelTransition();
    setActivePresetId(preset.id);

    const from = colorRef.current;
    const to = {
      r: preset.r,
      g: preset.g,
      b: preset.b,
      brightness: preset.brightness,
    };
    const { transitionEnabled: enabled, transitionDurationMs: durationMs } =
      transitionSettingsRef.current;
    const connected = statusRef.current === "connected";

    if (enabled && durationMs > 0) {
      animateColorTransition(
        from,
        to,
        durationMs,
        (color) => {
          setR(color.r);
          setG(color.g);
          setB(color.b);
          setBrightness(color.brightness);
        },
        { sendToLamp: connected }
      );
      return;
    }

    setR(to.r);
    setG(to.g);
    setB(to.b);
    setBrightness(to.brightness);
    if (connected) {
      void setColor(to.r, to.g, to.b, to.brightness);
    }
  };

  const handleSavePreset = (preset: LampPreset, sectionId: string) => {
    const isEdit = presets.some((p) => p.id === preset.id);
    let newPresets: LampPreset[];
    let newSections = [...sections];

    if (isEdit) {
      newPresets = presets.map((p) => (p.id === preset.id ? preset : p));
      const oldSection = sections.find((s) => s.presetIds.includes(preset.id));
      if (oldSection && oldSection.id !== sectionId) {
        newSections = newSections.map((s) => {
          if (s.id === oldSection.id) return { ...s, presetIds: s.presetIds.filter((id) => id !== preset.id) };
          if (s.id === sectionId) return { ...s, presetIds: [...s.presetIds, preset.id] };
          return s;
        });
      }
    } else {
      newPresets = [...presets, preset];
      newSections = newSections.map((s) =>
        s.id === sectionId ? { ...s, presetIds: [...s.presetIds, preset.id] } : s
      );
    }

    setPresets(newPresets);
    setSections(newSections);
    setSaveCurrentModal(false);
  };

  const connected = status === "connected";

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-[#ff8040]/30 border-t-[#ff8040] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#111114]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e24] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff8040]" />
          <h1 className="text-sm font-semibold text-[#f0f0f4]">Sunset Lamp Controller</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  connected ? "bg-green-400" : "bg-[#555568]"
                }`}
              />
            </span>
            <span className="text-[11px] font-mono text-[#555568]">SSL-99A4C3</span>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-1.5 text-[#555568] hover:text-[#9090a0] hover:bg-[#1e1e24] transition-colors"
            title="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Left panel */}
        <div className="w-72 flex-shrink-0 border-r border-[#1e1e24] flex flex-col overflow-y-auto p-4 gap-3">
          <ConnectionPanel
            status={status}
            onStatusChange={setStatus}
            error={error}
            onError={setError}
          />
          <ColorControlPanel
            r={r}
            g={g}
            b={b}
            brightness={brightness}
            status={status}
            liveUpdate={liveUpdate}
            onLiveUpdateChange={setLiveUpdate}
            onColorChange={handleColorChange}
            onSaveAsPreset={() => setSaveCurrentModal(true)}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 p-4 overflow-hidden flex flex-col">
          <PresetPanel
            presets={presets}
            sections={sections}
            activePresetId={activePresetId}
            currentR={r}
            currentG={g}
            currentB={b}
            currentBrightness={brightness}
            onActivate={handleActivatePreset}
            onPresetsChange={setPresets}
            onSectionsChange={setSections}
          />
        </div>
      </div>

      {/* Save current as preset modal */}
      <PresetEditorModal
        open={saveCurrentModal}
        sections={sections}
        defaultSectionId={sections[0]?.id ?? ""}
        currentR={r}
        currentG={g}
        currentB={b}
        currentBrightness={brightness}
        onSave={handleSavePreset}
        onCancel={() => setSaveCurrentModal(false)}
      />

      <SettingsModal
        open={settingsOpen}
        autoConnect={autoConnect}
        onAutoConnectChange={setAutoConnect}
        transitionEnabled={transitionEnabled}
        onTransitionEnabledChange={setTransitionEnabled}
        transitionDurationMs={transitionDurationMs}
        onTransitionDurationChange={setTransitionDurationMs}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

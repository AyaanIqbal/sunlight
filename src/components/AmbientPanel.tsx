import { useEffect, useState } from "react";
import { ChevronDown, Play, Square } from "lucide-react";
import type {
  AmbientBrightnessMode,
  AmbientBrightnessResponse,
  AmbientEdgePriority,
  AmbientFrameEvent,
  AmbientOutputFps,
  AmbientQuality,
  AmbientSettings,
  AmbientStatus,
} from "../types";

interface AmbientPanelProps {
  settings: AmbientSettings;
  onSettingsChange: (settings: AmbientSettings) => void;
  status: AmbientStatus;
  connected: boolean;
  currentR: number;
  currentG: number;
  currentB: number;
  manualBrightness: number;
  ambientBrightness: number | null;
  metrics: AmbientFrameEvent | null;
  onStart: () => void;
  onStop: () => void;
  onToast?: (message: string, variant?: "info" | "error") => void;
}

const QUALITY_OPTIONS: { id: AmbientQuality; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "balanced", label: "Balanced" },
  { id: "responsive_detail", label: "Responsive Detail" },
];

const FPS_OPTIONS: { fps: AmbientOutputFps; subtitle?: string }[] = [
  { fps: 4 },
  { fps: 8 },
  { fps: 10 },
  { fps: 12, subtitle: "Smoother · more bandwidth" },
  { fps: 15, subtitle: "Experimental · may be less stable" },
];

const EDGE_OPTIONS: { id: AmbientEdgePriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const RESPONSE_OPTIONS: { id: AmbientBrightnessResponse; label: string }[] = [
  { id: "dimmer", label: "Dimmer" },
  { id: "balanced", label: "Balanced" },
  { id: "brighter", label: "Brighter" },
];

function statusLabel(status: AmbientStatus): string {
  switch (status) {
    case "checking_permission":
      return "Checking permission…";
    case "waiting_for_permission":
      return "Waiting for permission…";
    case "starting_capture":
      return "Starting capture…";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "stopped":
      return "Stopped";
    default:
      return "Inactive";
  }
}

function statusColor(status: AmbientStatus): string {
  if (status === "running") return "text-[#34d399]";
  if (status === "failed") return "text-[#f87171]";
  if (status === "starting_capture" || status === "checking_permission") {
    return "text-[#60a5fa]";
  }
  return "text-[#9090a0]";
}

function rangeTrackStyle(value: number, min: number, max: number, color = "#34d399") {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, ${color} ${pct}%, #2e2e38 ${pct}%)`,
  } as const;
}

function brightnessPreviewLine(
  settings: AmbientSettings,
  manualBrightness: number,
  ambientBrightness: number | null,
  metrics: AmbientFrameEvent | null
): string {
  if (settings.brightnessMode === "manual") {
    return `Brightness: Manual (${manualBrightness}/64)`;
  }
  const computed = ambientBrightness ?? metrics?.computedBrightness;
  if (computed != null) {
    return `Brightness: ${computed}/64`;
  }
  return "Brightness: —";
}

export function AmbientPanel({
  settings,
  onSettingsChange,
  status,
  connected,
  currentR,
  currentG,
  currentB,
  manualBrightness,
  ambientBrightness,
  metrics,
  onStart,
  onStop,
}: AmbientPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const running = status === "running" || status === "starting_capture";

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const update = (patch: Partial<AmbientSettings>) => {
    const next = { ...localSettings, ...patch };
    setLocalSettings(next);
    onSettingsChange(next);
  };

  const hex = `#${currentR.toString(16).padStart(2, "0")}${currentG
    .toString(16)
    .padStart(2, "0")}${currentB.toString(16).padStart(2, "0")}`.toUpperCase();

  const brightnessLine = brightnessPreviewLine(
    localSettings,
    manualBrightness,
    ambientBrightness,
    metrics
  );

  return (
    <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#f0f0f4]">Ambient Screen Mode</h3>
            <p className={`text-[10px] mt-0.5 ${statusColor(status)}`}>
              {statusLabel(status)}
            </p>
          </div>
          {running ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-medium text-[#f87171] hover:bg-red-500/25 transition-colors"
            >
              <Square size={11} />
              Stop
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!connected}
              className="flex items-center gap-1.5 rounded-lg bg-[#34d399]/15 px-2.5 py-1.5 text-xs font-medium text-[#34d399] hover:bg-[#34d399]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={11} />
              Start
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-lg border border-[#2e2e38] flex-shrink-0"
            style={{ backgroundColor: `rgb(${currentR}, ${currentG}, ${currentB})` }}
          />
          <div className="text-[10px] text-[#9090a0] font-mono space-y-0.5">
            <div>
              RGB {currentR}, {currentG}, {currentB}
            </div>
            <div>{hex}</div>
            <div>{brightnessLine}</div>
          </div>
        </div>

        <p className="text-[10px] text-[#555568] leading-relaxed">
          Frames are processed locally and are not saved. The app only uses averaged colors to
          control the lamp.
        </p>
      </div>

      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-3 space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider text-[#555568]">Brightness</h4>

        <label className="flex items-center justify-between text-[10px] text-[#9090a0] cursor-pointer">
          <span>Dynamic Brightness</span>
          <input
            type="checkbox"
            checked={localSettings.brightnessMode === "dynamic"}
            onChange={(e) =>
              update({
                brightnessMode: (e.target.checked ? "dynamic" : "manual") as AmbientBrightnessMode,
              })
            }
            className="accent-[#34d399]"
          />
        </label>

        <div className="space-y-1.5">
          <label className="text-[10px] text-[#9090a0]">Response</label>
          <div className="flex rounded-lg border border-[#2e2e38] p-0.5 gap-0.5 flex-wrap">
            {RESPONSE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ brightnessResponse: opt.id })}
                className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  localSettings.brightnessResponse === opt.id
                    ? "bg-[#2e2e38] text-[#f0f0f4]"
                    : "text-[#555568] hover:text-[#9090a0]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>Dimmer</span>
            <span>Brighter</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={localSettings.brightnessResponseFineTune}
            onChange={(e) =>
              update({ brightnessResponseFineTune: Number(e.target.value) })
            }
            className="w-full"
            style={rangeTrackStyle(localSettings.brightnessResponseFineTune, 0, 1)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>Black Threshold</span>
            <span className="font-mono">{localSettings.blackThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.01}
            value={localSettings.blackThreshold}
            onChange={(e) => update({ blackThreshold: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(localSettings.blackThreshold, 0, 0.2)}
          />
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between text-[10px] text-[#9090a0] hover:text-[#f0f0f4] transition-colors pt-1"
        >
          <span className="uppercase tracking-wider">Advanced Brightness</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-3 pt-1 border-t border-[#2e2e38]">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Min Active Brightness</span>
                <span className="font-mono">{localSettings.minActiveBrightness}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={localSettings.minActiveBrightness}
                onChange={(e) =>
                  update({ minActiveBrightness: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(localSettings.minActiveBrightness, 0, 20)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Max Brightness</span>
                <span className="font-mono">{localSettings.maxBrightness}</span>
              </div>
              <input
                type="range"
                min={1}
                max={64}
                step={1}
                value={localSettings.maxBrightness}
                onChange={(e) => update({ maxBrightness: Number(e.target.value) })}
                className="w-full"
                style={rangeTrackStyle(localSettings.maxBrightness, 1, 64)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Brightness Smoothing</span>
                <span className="font-mono">
                  {localSettings.brightnessSmoothing.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.01}
                value={localSettings.brightnessSmoothing}
                onChange={(e) =>
                  update({ brightnessSmoothing: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(localSettings.brightnessSmoothing, 0.05, 0.6)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Center Contribution</span>
                <span className="font-mono">
                  {localSettings.centerContribution.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.35}
                step={0.01}
                value={localSettings.centerContribution}
                onChange={(e) =>
                  update({ centerContribution: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(localSettings.centerContribution, 0, 0.35)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Highlight Influence</span>
                <span className="font-mono">
                  {localSettings.highlightInfluence.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.01}
                value={localSettings.highlightInfluence}
                onChange={(e) =>
                  update({ highlightInfluence: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(localSettings.highlightInfluence, 0, 0.6)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-3 space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider text-[#555568]">Tuning</h4>

        <div className="space-y-1.5">
          <label className="text-[10px] text-[#9090a0]">Quality</label>
          <div className="flex rounded-lg border border-[#2e2e38] p-0.5 gap-0.5 flex-wrap">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ quality: opt.id })}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  localSettings.quality === opt.id
                    ? "bg-[#2e2e38] text-[#f0f0f4]"
                    : "text-[#555568] hover:text-[#9090a0]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-[#9090a0]">Output Rate</label>
          <div className="flex flex-col gap-1">
            <div className="flex rounded-lg border border-[#2e2e38] p-0.5 gap-0.5 flex-wrap">
              {FPS_OPTIONS.map((opt) => (
                <button
                  key={opt.fps}
                  type="button"
                  onClick={() => update({ outputFps: opt.fps })}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    localSettings.outputFps === opt.fps
                      ? "bg-[#2e2e38] text-[#f0f0f4]"
                      : "text-[#555568] hover:text-[#9090a0]"
                  }`}
                >
                  {opt.fps} FPS
                </button>
              ))}
            </div>
            {FPS_OPTIONS.filter((o) => o.subtitle).map((opt) =>
              localSettings.outputFps === opt.fps ? (
                <p key={opt.fps} className="text-[9px] text-[#555568] pl-0.5">
                  {opt.subtitle}
                </p>
              ) : null
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-[#9090a0]">Edge Priority</label>
          <div className="flex rounded-lg border border-[#2e2e38] p-0.5 gap-0.5">
            {EDGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ edgePriority: opt.id })}
                className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  localSettings.edgePriority === opt.id
                    ? "bg-[#2e2e38] text-[#f0f0f4]"
                    : "text-[#555568] hover:text-[#9090a0]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>Saturation Boost</span>
            <span className="font-mono">{localSettings.saturationBoost.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={2.2}
            step={0.05}
            value={localSettings.saturationBoost}
            onChange={(e) => update({ saturationBoost: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(localSettings.saturationBoost, 0.8, 2.2)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>RGB Brightness Boost</span>
            <span className="font-mono">{localSettings.brightnessBoost.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.6}
            step={0.05}
            value={localSettings.brightnessBoost}
            onChange={(e) => update({ brightnessBoost: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(localSettings.brightnessBoost, 0.8, 1.6)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>RGB Smoothing</span>
            <span>Responsive</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={localSettings.responsiveness}
            onChange={(e) => update({ responsiveness: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(localSettings.responsiveness, 0, 1)}
          />
        </div>

        <label className="flex items-center justify-between text-[10px] text-[#9090a0] cursor-pointer">
          <span>Debug metrics</span>
          <input
            type="checkbox"
            checked={localSettings.debug}
            onChange={(e) => update({ debug: e.target.checked })}
            className="accent-[#34d399]"
          />
        </label>

        {settings.debug && metrics && (
          <div className="rounded-lg border border-[#2e2e38] bg-[#111114] p-2 text-[10px] font-mono text-[#9090a0] space-y-1">
            <div>Sample FPS: {metrics.sampleFps?.toFixed(1) ?? "—"}</div>
            <div>BLE FPS: {metrics.outputFps?.toFixed(1) ?? "—"}</div>
            <div>Processing: {metrics.processingMs?.toFixed(1) ?? "—"} ms</div>
            <div>Skipped sends: {metrics.skippedSends ?? 0}</div>
            <div className="pt-1 border-t border-[#2e2e38] mt-1 space-y-1">
              <div>Computed brightness: {metrics.computedBrightness ?? "—"}</div>
              <div>Target brightness: {metrics.targetBrightness ?? "—"}</div>
              <div>Smoothed brightness: {metrics.smoothedBrightness ?? "—"}</div>
              <div>Edge intensity: {metrics.edgeIntensity?.toFixed(3) ?? "—"}</div>
              <div>Center intensity: {metrics.centerIntensity?.toFixed(3) ?? "—"}</div>
              <div>Spatial intensity: {metrics.spatialIntensity?.toFixed(3) ?? "—"}</div>
              <div>Highlight intensity: {metrics.highlightIntensity?.toFixed(3) ?? "—"}</div>
              <div>Screen intensity: {metrics.screenIntensity?.toFixed(3) ?? "—"}</div>
              <div>Mode: {metrics.brightnessMode ?? "—"}</div>
              <div>Black threshold: {metrics.blackThreshold?.toFixed(3) ?? "—"}</div>
              <div>Center contribution: {metrics.centerContribution?.toFixed(3) ?? "—"}</div>
              <div>Highlight influence: {metrics.highlightInfluence?.toFixed(3) ?? "—"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Play, Square } from "lucide-react";
import type {
  AmbientBrightnessMode,
  AmbientBrightnessResponse,
  AmbientDebugMetrics,
  AmbientEdgePriority,
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
  debugMetrics: AmbientDebugMetrics | null;
  onStart: () => void;
  onStop: () => void;
  onToast?: (message: string, variant?: "info" | "error") => void;
}

const QUALITY_OPTIONS: { id: AmbientQuality; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "balanced", label: "Balanced" },
  { id: "responsive_detail", label: "Responsive Detail" },
];

const FPS_OPTIONS: { fps: AmbientOutputFps; subtitle?: string; helper?: string }[] = [
  { fps: 4 },
  { fps: 8 },
  { fps: 10 },
  { fps: 12, subtitle: "Smoother · more bandwidth" },
  { fps: 15, subtitle: "Experimental · may be less stable" },
  { fps: 20, subtitle: "Experimental · may use more Bluetooth bandwidth" },
  { fps: 25, subtitle: "Experimental · may be less stable" },
  {
    fps: 30,
    subtitle: "Experimental · lowest latency, may use more Bluetooth bandwidth",
    helper: "Lowest latency. May be less stable on some Bluetooth devices.",
  },
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
  ambientBrightness: number | null
): string {
  if (settings.brightnessMode === "manual") {
    return `Brightness: Manual (${manualBrightness}/64)`;
  }
  if (ambientBrightness != null) {
    return `Brightness: ${ambientBrightness}/64`;
  }
  return "Brightness: —";
}

const QUALITY_LABELS: Record<AmbientQuality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  responsive_detail: "Responsive Detail",
};

const RESPONSE_LABELS: Record<AmbientBrightnessResponse, string> = {
  dimmer: "Dimmer",
  balanced: "Balanced",
  brighter: "Brighter",
};

function formatDebugSnapshot(
  settings: AmbientSettings,
  m: AmbientDebugMetrics,
  hex: string,
  r: number,
  g: number,
  b: number
): string {
  return [
    "Ambient Debug Snapshot",
    "",
    "Ambient Settings",
    `Quality: ${QUALITY_LABELS[settings.quality]}`,
    `Output FPS Target: ${m.targetOutputFps}`,
    `Brightness Mode: ${settings.brightnessMode}`,
    `Brightness Response: ${RESPONSE_LABELS[settings.brightnessResponse]}`,
    `Black Threshold: ${settings.blackThreshold.toFixed(2)}`,
    `Center Contribution: ${settings.centerContribution.toFixed(2)}`,
    `Highlight Influence: ${settings.highlightInfluence.toFixed(2)}`,
    `Min Color Delta: ${settings.minColorDelta}`,
    "",
    `Capture FPS: ${m.captureFps.toFixed(1)}`,
    `Actual Output FPS: ${m.actualOutputFps.toFixed(1)}`,
    `Capture Time Avg: ${m.captureTimeMsAvg.toFixed(1)}ms`,
    `Processing Time Avg: ${m.processingTimeMsAvg.toFixed(1)}ms`,
    `BLE Write Time Avg: ${m.bleWriteTimeMsAvg.toFixed(1)}ms`,
    `BLE Failures: ${m.bleWriteFailures}`,
    `Delta Skips: ${m.skippedDueToDelta}`,
    `Rate Limit Skips: ${m.skippedDueToRateLimit}`,
    `Duplicate Skips: ${m.skippedDueToDuplicate}`,
    `Busy Skips: ${m.bleBusySkips ?? 0}`,
    `Dropped Frames: ${m.droppedFrames ?? 0}`,
    `Screen Intensity: ${m.screenIntensity.toFixed(2)}`,
    `Computed Brightness: ${m.computedBrightness}/64`,
    `Color: ${hex} RGB(${r}, ${g}, ${b})`,
  ].join("\n");
}

function MetricSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] uppercase tracking-wider text-[#555568]">{title}</div>
      {children}
    </div>
  );
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
  debugMetrics,
  onStart,
  onStop,
  onToast,
}: AmbientPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [detailedMetricsOpen, setDetailedMetricsOpen] = useState(false);
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
    ambientBrightness
  );

  const handleCopyDebugSnapshot = async () => {
    if (!debugMetrics) return;
    const text = formatDebugSnapshot(
      localSettings,
      debugMetrics,
      hex,
      currentR,
      currentG,
      currentB
    );
    try {
      await navigator.clipboard.writeText(text);
      onToast?.("Debug snapshot copied to clipboard.");
    } catch {
      onToast?.("Could not copy to clipboard.", "error");
    }
  };

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
                <div key={opt.fps} className="space-y-0.5 pl-0.5">
                  <p className="text-[9px] text-[#555568]">{opt.subtitle}</p>
                  {opt.helper ? (
                    <p className="text-[9px] text-[#555568]">{opt.helper}</p>
                  ) : null}
                </div>
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

        {localSettings.debug && debugMetrics && (
          <div className="rounded-lg border border-[#2e2e38] bg-[#111114] p-2 text-[10px] font-mono text-[#9090a0] space-y-2">
            <MetricSection title="Capture">
              <div>Capture FPS: {debugMetrics.captureFps.toFixed(1)}</div>
              {debugMetrics.targetCaptureFps != null && (
                <div>Target capture FPS: {debugMetrics.targetCaptureFps.toFixed(1)}</div>
              )}
              <div>
                Capture time: {debugMetrics.captureTimeMsAvg.toFixed(1)} ms avg /{" "}
                {debugMetrics.captureTimeMsLast.toFixed(1)} ms last
              </div>
              <div>Capture failures: {debugMetrics.captureFailures}</div>
            </MetricSection>

            <MetricSection title="Processing">
              <div>
                Processing: {debugMetrics.processingTimeMsAvg.toFixed(1)} ms avg /{" "}
                {debugMetrics.processingTimeMsLast.toFixed(1)} ms last
              </div>
              {debugMetrics.downsampleTimeMsAvg != null && (
                <div>Downsample: {debugMetrics.downsampleTimeMsAvg.toFixed(1)} ms avg</div>
              )}
              {debugMetrics.algorithmTimeMsAvg != null && (
                <div>Algorithm: {debugMetrics.algorithmTimeMsAvg.toFixed(1)} ms avg</div>
              )}
            </MetricSection>

            <MetricSection title="Output">
              <div>Target output FPS: {debugMetrics.targetOutputFps}</div>
              <div>Actual output FPS: {debugMetrics.actualOutputFps.toFixed(1)}</div>
              <div>
                Output interval avg: {debugMetrics.outputIntervalMsAvg.toFixed(1)} ms
              </div>
              <div>
                Since last BLE send: {debugMetrics.timeSinceLastBleSendMs.toFixed(0)} ms
              </div>
            </MetricSection>

            <MetricSection title="Bluetooth">
              <div>
                BLE write: {debugMetrics.bleWriteTimeMsAvg.toFixed(1)} ms avg /{" "}
                {debugMetrics.bleWriteTimeMsLast.toFixed(1)} ms last
              </div>
              <div>BLE failures: {debugMetrics.bleWriteFailures}</div>
              {debugMetrics.bleWritesInFlight != null && (
                <div>In-flight writes: {debugMetrics.bleWritesInFlight}</div>
              )}
              {debugMetrics.bleBusySkips != null && (
                <div>Busy skips: {debugMetrics.bleBusySkips}</div>
              )}
            </MetricSection>

            <MetricSection title="Skips">
              <div>Delta skips: {debugMetrics.skippedDueToDelta}</div>
              <div>Rate limit skips: {debugMetrics.skippedDueToRateLimit}</div>
              <div>Duplicate skips: {debugMetrics.skippedDueToDuplicate}</div>
              <div>Stale connection skips: {debugMetrics.skippedDueToStaleConnection}</div>
              {debugMetrics.droppedFrames != null && (
                <div>Dropped frames: {debugMetrics.droppedFrames}</div>
              )}
            </MetricSection>

            <MetricSection title="Current Output">
              <div>
                RGB {currentR}, {currentG}, {currentB} · {hex}
              </div>
              <div>Brightness: {debugMetrics.computedBrightness}/64</div>
              <div>Screen intensity: {debugMetrics.screenIntensity.toFixed(3)}</div>
              <div>Color delta: {debugMetrics.colorDeltaLast}</div>
              <div>Brightness delta: {debugMetrics.brightnessDeltaLast}</div>
            </MetricSection>

            <button
              type="button"
              onClick={() => setDetailedMetricsOpen((o) => !o)}
              className="flex w-full items-center justify-between text-[9px] uppercase tracking-wider text-[#555568] hover:text-[#9090a0] pt-1 border-t border-[#2e2e38]"
            >
              <span>Detailed Metrics</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${detailedMetricsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {detailedMetricsOpen && (
              <div className="space-y-0.5 pt-1">
                <div>Target brightness: {debugMetrics.targetBrightness ?? "—"}</div>
                <div>Smoothed brightness: {debugMetrics.smoothedBrightness ?? "—"}</div>
                <div>Edge intensity: {debugMetrics.edgeIntensity?.toFixed(3) ?? "—"}</div>
                <div>Center intensity: {debugMetrics.centerIntensity?.toFixed(3) ?? "—"}</div>
                <div>Spatial intensity: {debugMetrics.spatialIntensity?.toFixed(3) ?? "—"}</div>
                <div>
                  Highlight intensity: {debugMetrics.highlightIntensity?.toFixed(3) ?? "—"}
                </div>
                <div>Mode: {debugMetrics.brightnessMode ?? "—"}</div>
                <div>Black threshold: {debugMetrics.blackThreshold?.toFixed(3) ?? "—"}</div>
                <div>
                  Center contribution: {debugMetrics.centerContribution?.toFixed(3) ?? "—"}
                </div>
                <div>
                  Highlight influence: {debugMetrics.highlightInfluence?.toFixed(3) ?? "—"}
                </div>
                <div>
                  Since last frame: {debugMetrics.timeSinceLastFrameMs.toFixed(0)} ms
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleCopyDebugSnapshot()}
              className="w-full rounded-md border border-[#2e2e38] px-2 py-1 text-[10px] text-[#9090a0] hover:text-[#f0f0f4] hover:border-[#555568] transition-colors"
            >
              Copy Debug Snapshot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

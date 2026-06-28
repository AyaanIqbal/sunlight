import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Play, Square } from "lucide-react";
import type {
  AmbientBrightnessResponse,
  AmbientConfig,
  AmbientDebugMetrics,
  AmbientQuality,
  AmbientSettings,
  AmbientStatus,
} from "../types";
import { DEFAULT_AMBIENT_SETTINGS } from "../types";
import { formatOutputRate, isAdaptiveMax } from "../ambientDefaults";
import {
  createAmbientConfig,
  findActiveConfig,
  formatConfigSummary,
} from "../ambientConfigUtils";
import { AmbientConfigCard } from "./AmbientConfigCard";
import { AmbientConfigEditorModal } from "./AmbientConfigEditorModal";
import { AmbientSettingsForm } from "./AmbientSettingsForm";
import { ConfirmDialog } from "./ConfirmDialog";

interface AmbientPanelProps {
  settings: AmbientSettings;
  onSettingsChange: (settings: AmbientSettings) => void;
  ambientConfigs: AmbientConfig[];
  ambientConfigOrder: string[];
  onConfigsChange: (configs: AmbientConfig[]) => void;
  onConfigOrderChange: (order: string[]) => void;
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

type ConfigModalState =
  | { type: "save" }
  | { type: "edit"; config: AmbientConfig }
  | { type: "delete"; config: AmbientConfig }
  | { type: "restoreDefaults" }
  | null;

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

function formatDebugSnapshot(
  settings: AmbientSettings,
  m: AmbientDebugMetrics,
  hex: string,
  r: number,
  g: number,
  b: number,
  activeConfigName?: string | null
): string {
  const lines = [
    "Ambient Debug Snapshot",
    "",
    "Ambient Settings",
    `Quality: ${QUALITY_LABELS[settings.quality]}`,
    `Output Mode: ${formatOutputRate(settings.outputFps)}`,
  ];
  if (m.adaptiveModeEnabled && m.adaptiveTargetFps != null) {
    lines.push(`Adaptive Target: ${Math.round(m.adaptiveTargetFps)} FPS`);
    if (m.adaptiveState) {
      lines.push(`Adaptive State: ${m.adaptiveState.replace(/_/g, " ")}`);
    }
    if (m.adaptiveReason) {
      lines.push(`Last Adjustment: ${m.adaptiveReason}`);
    }
    if (m.adaptiveCaptureTargetFps != null) {
      lines.push(`Capture Target FPS: ${Math.round(m.adaptiveCaptureTargetFps)}`);
    }
    if (m.adaptiveOutputTargetFps != null) {
      lines.push(`Output Target FPS: ${Math.round(m.adaptiveOutputTargetFps)}`);
    }
    if (m.adaptiveFrameBudgetMs != null) {
      lines.push(`Frame Budget: ${m.adaptiveFrameBudgetMs.toFixed(1)} ms`);
    }
  } else {
    lines.push(`Output FPS Target: ${m.targetOutputFps}`);
  }
  lines.push(
    `Brightness Mode: ${settings.brightnessMode}`,
    `Brightness Response: ${RESPONSE_LABELS[settings.brightnessResponse]}`,
    `Black Threshold: ${settings.blackThreshold.toFixed(2)}`,
    `Center Contribution: ${settings.centerContribution.toFixed(2)}`,
    `Highlight Influence: ${settings.highlightInfluence.toFixed(2)}`,
    `Min Color Delta: ${settings.minColorDelta}`
  );
  if (activeConfigName) {
    lines.push(`Active Config: ${activeConfigName}`);
  }
  lines.push(
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
    `Consecutive Capture Failures: ${m.consecutiveCaptureFailures ?? 0}`,
    `Capture Timeouts: ${m.captureTimeouts ?? 0}`,
    `Stale Captures Discarded: ${m.staleCaptureDiscarded ?? 0}`,
    `Capture In Flight: ${m.captureInFlight ? "yes" : "no"}`,
    `Capture Backoff: ${m.captureBackoffActive ? "yes" : "no"}`,
    `Global BLE In Flight: ${m.globalBleWriteInFlight ?? 0}`,
    `Global BLE Timeouts: ${m.globalBleWriteTimeoutCount ?? 0}`,
    `Global BLE Gate Busy: ${m.globalBleWriteGateBusyCount ?? 0}`,
    ...(m.adaptiveRecentBleFailureDelta != null
      ? [`Adaptive BLE Failure Delta: ${m.adaptiveRecentBleFailureDelta}`]
      : []),
    ...(m.lastAmbientStopReason
      ? [`Last Stop Reason: ${m.lastAmbientStopReason}`]
      : []),
    `Screen Intensity: ${m.screenIntensity.toFixed(2)}`,
    `Computed Brightness: ${m.computedBrightness}/64`,
    `Color: ${hex} RGB(${r}, ${g}, ${b})`
  );
  return lines.join("\n");
}

function MetricSection({ title, children }: { title: string; children: ReactNode }) {
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
  ambientConfigs,
  ambientConfigOrder,
  onConfigsChange,
  onConfigOrderChange,
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
  const [detailedMetricsOpen, setDetailedMetricsOpen] = useState(false);
  const [modal, setModal] = useState<ConfigModalState>(null);
  const [dragOverlayId, setDragOverlayId] = useState<string | null>(null);
  const running = status === "running" || status === "starting_capture";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const configMap = useMemo(
    () => new Map(ambientConfigs.map((c) => [c.id, c])),
    [ambientConfigs]
  );

  const orderedConfigs = useMemo(
    () =>
      ambientConfigOrder
        .map((id) => configMap.get(id))
        .filter((c): c is AmbientConfig => c != null),
    [ambientConfigOrder, configMap]
  );

  const activeConfig = useMemo(
    () => findActiveConfig(ambientConfigs, localSettings),
    [ambientConfigs, localSettings]
  );

  const update = (next: AmbientSettings) => {
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

  const adaptiveStatusText = useMemo(() => {
    if (!isAdaptiveMax(localSettings.outputFps) || !running) return null;
    if (debugMetrics?.adaptiveTargetFps != null) {
      return `Adaptive Max is targeting ${Math.round(debugMetrics.adaptiveTargetFps)} FPS`;
    }
    return "Adaptive Max is tuning for the fastest stable response.";
  }, [localSettings.outputFps, running, debugMetrics?.adaptiveTargetFps]);

  const handleCopyDebugSnapshot = async () => {
    if (!debugMetrics) return;
    const text = formatDebugSnapshot(
      localSettings,
      debugMetrics,
      hex,
      currentR,
      currentG,
      currentB,
      activeConfig?.name
    );
    try {
      await navigator.clipboard.writeText(text);
      onToast?.("Debug snapshot copied to clipboard.");
    } catch {
      onToast?.("Could not copy to clipboard.", "error");
    }
  };

  const handleSaveConfig = (name: string, draftSettings: AmbientSettings) => {
    if (modal?.type === "edit") {
      const now = new Date().toISOString();
      const updated = ambientConfigs.map((c) =>
        c.id === modal.config.id
          ? { ...c, name, settings: draftSettings, updatedAt: now }
          : c
      );
      onConfigsChange(updated);
      onToast?.(`Saved "${name}" config.`);
    } else {
      const config = createAmbientConfig(name, draftSettings);
      onConfigsChange([...ambientConfigs, config]);
      onConfigOrderChange([...ambientConfigOrder, config.id]);
      onToast?.(`Saved "${name}" config.`);
    }
    setModal(null);
  };

  const handleApplyConfig = (config: AmbientConfig) => {
    update(config.settings);
    onToast?.(`Applied "${config.name}" config.`);
  };

  const handleDeleteConfig = (config: AmbientConfig) => {
    onConfigsChange(ambientConfigs.filter((c) => c.id !== config.id));
    onConfigOrderChange(ambientConfigOrder.filter((id) => id !== config.id));
    setModal(null);
    onToast?.(`Deleted "${config.name}" config.`);
  };

  const handleRestoreDefaults = () => {
    update(DEFAULT_AMBIENT_SETTINGS);
    setModal(null);
    onToast?.("Ambient settings restored to defaults.");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragOverlayId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ambientConfigOrder.indexOf(String(active.id));
    const newIndex = ambientConfigOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onConfigOrderChange(arrayMove(ambientConfigOrder, oldIndex, newIndex));
  };

  const dragOverlayConfig = dragOverlayId ? configMap.get(dragOverlayId) : null;

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModal({ type: "save" })}
          className="flex-1 rounded-lg border border-[#2e2e38] bg-[#18181c] px-3 py-2 text-xs font-medium text-[#9090a0] hover:text-[#f0f0f4] hover:border-[#555568] transition-colors"
        >
          Save Config
        </button>
        <button
          type="button"
          onClick={() => setModal({ type: "restoreDefaults" })}
          className="flex-1 rounded-lg border border-[#2e2e38] bg-[#18181c] px-3 py-2 text-xs font-medium text-[#9090a0] hover:text-[#f0f0f4] hover:border-[#555568] transition-colors"
        >
          Restore Defaults
        </button>
      </div>

      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-3 space-y-2">
        <h4 className="text-[10px] uppercase tracking-wider text-[#555568]">My Configs</h4>

        {orderedConfigs.length === 0 ? (
          <p className="text-[10px] text-[#555568] py-2">No saved configs yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setDragOverlayId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragOverlayId(null)}
          >
            <SortableContext
              items={ambientConfigOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {orderedConfigs.map((config) => (
                  <AmbientConfigCard
                    key={config.id}
                    config={config}
                    active={activeConfig?.id === config.id}
                    onApply={() => handleApplyConfig(config)}
                    onEdit={() => setModal({ type: "edit", config })}
                    onDelete={() => setModal({ type: "delete", config })}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {dragOverlayConfig ? (
                <div className="rounded-lg border border-[#34d399]/40 bg-[#202028] px-3 py-2.5 shadow-xl opacity-90">
                  <p className="text-xs font-medium text-[#f0f0f4]">{dragOverlayConfig.name}</p>
                  <p className="text-[10px] text-[#555568]">
                    {formatConfigSummary(dragOverlayConfig.settings)}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <AmbientSettingsForm
        settings={localSettings}
        onChange={update}
        adaptiveStatusText={adaptiveStatusText}
      />

      {localSettings.debug && debugMetrics && (
        <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-3 space-y-2">
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

            {debugMetrics.adaptiveModeEnabled && (
              <MetricSection title="Adaptive Max">
                <div>
                  Adaptive target:{" "}
                  {debugMetrics.adaptiveTargetFps != null
                    ? `${Math.round(debugMetrics.adaptiveTargetFps)} FPS`
                    : "—"}
                </div>
                <div>
                  Capture target:{" "}
                  {debugMetrics.adaptiveCaptureTargetFps != null
                    ? `${Math.round(debugMetrics.adaptiveCaptureTargetFps)} FPS`
                    : "—"}
                </div>
                <div>
                  Output target:{" "}
                  {debugMetrics.adaptiveOutputTargetFps != null
                    ? `${Math.round(debugMetrics.adaptiveOutputTargetFps)} FPS`
                    : "—"}
                </div>
                <div>State: {debugMetrics.adaptiveState?.replace(/_/g, " ") ?? "—"}</div>
                {debugMetrics.adaptiveReason && (
                  <div>Last adjustment: {debugMetrics.adaptiveReason}</div>
                )}
                {debugMetrics.adaptiveFrameBudgetMs != null && (
                  <div>Frame budget: {debugMetrics.adaptiveFrameBudgetMs.toFixed(1)} ms</div>
                )}
                {debugMetrics.adaptiveStabilityScore != null && (
                  <div>
                    Stability score: {debugMetrics.adaptiveStabilityScore.toFixed(0)}
                  </div>
                )}
              </MetricSection>
            )}

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
        </div>
      )}

      <AmbientConfigEditorModal
        open={modal?.type === "save" || modal?.type === "edit"}
        mode={modal?.type === "edit" ? "edit" : "save"}
        initialName={modal?.type === "edit" ? modal.config.name : ""}
        initialSettings={
          modal?.type === "edit"
            ? modal.config.settings
            : modal?.type === "save"
              ? localSettings
              : DEFAULT_AMBIENT_SETTINGS
        }
        onSave={handleSaveConfig}
        onCancel={() => setModal(null)}
        onValidationError={(msg) => onToast?.(msg, "error")}
      />

      <ConfirmDialog
        open={modal?.type === "delete"}
        title={
          modal?.type === "delete" ? `Delete "${modal.config.name}"?` : ""
        }
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (modal?.type === "delete") handleDeleteConfig(modal.config);
        }}
        onCancel={() => setModal(null)}
      />

      <ConfirmDialog
        open={modal?.type === "restoreDefaults"}
        title="Restore Ambient settings to defaults?"
        message="Your saved configs will not be deleted."
        confirmLabel="Restore Defaults"
        onConfirm={handleRestoreDefaults}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}

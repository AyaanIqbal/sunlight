import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type {
  AmbientBrightnessMode,
  AmbientBrightnessResponse,
  AmbientEdgePriority,
  AmbientFixedOutputFps,
  AmbientQuality,
  AmbientSettings,
} from "../types";
import { ADAPTIVE_MAX_OUTPUT_RATE, isAdaptiveMax } from "../ambientDefaults";

const QUALITY_OPTIONS: { id: AmbientQuality; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "balanced", label: "Balanced" },
  { id: "responsive_detail", label: "Responsive Detail" },
];

const FPS_OPTIONS: { fps: AmbientFixedOutputFps; subtitle?: string; helper?: string }[] = [
  { fps: 4 },
  { fps: 8 },
  { fps: 10 },
  { fps: 12, subtitle: "Smoother · more bandwidth" },
  { fps: 15, subtitle: "Experimental · may be less stable" },
  { fps: 20, subtitle: "Experimental · may use more Bluetooth bandwidth" },
  { fps: 25, subtitle: "Experimental · may be less stable" },
  { fps: 30, subtitle: "Fixed 30 FPS · lowest fixed latency" },
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

function rangeTrackStyle(value: number, min: number, max: number, color = "#34d399") {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, ${color} ${pct}%, #2e2e38 ${pct}%)`,
  } as const;
}

export interface AmbientSettingsFormProps {
  settings: AmbientSettings;
  onChange: (settings: AmbientSettings) => void;
  showDebug?: boolean;
  adaptiveStatusText?: string | null;
}

export function AmbientSettingsForm({
  settings,
  onChange,
  showDebug = true,
  adaptiveStatusText = null,
}: AmbientSettingsFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (patch: Partial<AmbientSettings>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-3 space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider text-[#555568]">Brightness</h4>

        <label className="flex items-center justify-between text-[10px] text-[#9090a0] cursor-pointer">
          <span>Dynamic Brightness</span>
          <input
            type="checkbox"
            checked={settings.brightnessMode === "dynamic"}
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
                  settings.brightnessResponse === opt.id
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
            value={settings.brightnessResponseFineTune}
            onChange={(e) =>
              update({ brightnessResponseFineTune: Number(e.target.value) })
            }
            className="w-full"
            style={rangeTrackStyle(settings.brightnessResponseFineTune, 0, 1)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>Black Threshold</span>
            <span className="font-mono">{settings.blackThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.01}
            value={settings.blackThreshold}
            onChange={(e) => update({ blackThreshold: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(settings.blackThreshold, 0, 0.2)}
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
                <span className="font-mono">{settings.minActiveBrightness}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={settings.minActiveBrightness}
                onChange={(e) =>
                  update({ minActiveBrightness: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(settings.minActiveBrightness, 0, 20)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Max Brightness</span>
                <span className="font-mono">{settings.maxBrightness}</span>
              </div>
              <input
                type="range"
                min={1}
                max={64}
                step={1}
                value={settings.maxBrightness}
                onChange={(e) => update({ maxBrightness: Number(e.target.value) })}
                className="w-full"
                style={rangeTrackStyle(settings.maxBrightness, 1, 64)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Brightness Smoothing</span>
                <span className="font-mono">{settings.brightnessSmoothing.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.01}
                value={settings.brightnessSmoothing}
                onChange={(e) =>
                  update({ brightnessSmoothing: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(settings.brightnessSmoothing, 0.05, 0.6)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Center Contribution</span>
                <span className="font-mono">{settings.centerContribution.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.35}
                step={0.01}
                value={settings.centerContribution}
                onChange={(e) =>
                  update({ centerContribution: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(settings.centerContribution, 0, 0.35)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#9090a0]">
                <span>Highlight Influence</span>
                <span className="font-mono">{settings.highlightInfluence.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.01}
                value={settings.highlightInfluence}
                onChange={(e) =>
                  update({ highlightInfluence: Number(e.target.value) })
                }
                className="w-full"
                style={rangeTrackStyle(settings.highlightInfluence, 0, 0.6)}
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
                  settings.quality === opt.id
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
                    settings.outputFps === opt.fps
                      ? "bg-[#2e2e38] text-[#f0f0f4]"
                      : "text-[#555568] hover:text-[#9090a0]"
                  }`}
                >
                  {opt.fps} FPS
                </button>
              ))}
              <button
                type="button"
                onClick={() => update({ outputFps: ADAPTIVE_MAX_OUTPUT_RATE })}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  isAdaptiveMax(settings.outputFps)
                    ? "bg-[#2e2e38] text-[#f0f0f4]"
                    : "text-[#555568] hover:text-[#9090a0]"
                }`}
              >
                Adaptive Max
              </button>
            </div>
            {FPS_OPTIONS.filter((o) => o.subtitle).map((opt) =>
              settings.outputFps === opt.fps ? (
                <div key={opt.fps} className="space-y-0.5 pl-0.5">
                  <p className="text-[9px] text-[#555568]">{opt.subtitle}</p>
                  {opt.helper ? (
                    <p className="text-[9px] text-[#555568]">{opt.helper}</p>
                  ) : null}
                </div>
              ) : null
            )}
            {isAdaptiveMax(settings.outputFps) ? (
              <div className="space-y-0.5 pl-0.5">
                <p className="text-[9px] text-[#555568]">
                  Experimental: automatically targets the fastest stable response up to 60 FPS.
                  May use more Bluetooth bandwidth or be less stable on some devices.
                </p>
                {adaptiveStatusText ? (
                  <p className="text-[9px] text-[#9090a0]">{adaptiveStatusText}</p>
                ) : null}
              </div>
            ) : null}
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
                  settings.edgePriority === opt.id
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
            <span className="font-mono">{settings.saturationBoost.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={2.2}
            step={0.05}
            value={settings.saturationBoost}
            onChange={(e) => update({ saturationBoost: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(settings.saturationBoost, 0.8, 2.2)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#9090a0]">
            <span>RGB Brightness Boost</span>
            <span className="font-mono">{settings.brightnessBoost.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.6}
            step={0.05}
            value={settings.brightnessBoost}
            onChange={(e) => update({ brightnessBoost: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(settings.brightnessBoost, 0.8, 1.6)}
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
            value={settings.responsiveness}
            onChange={(e) => update({ responsiveness: Number(e.target.value) })}
            className="w-full"
            style={rangeTrackStyle(settings.responsiveness, 0, 1)}
          />
        </div>

        {showDebug && (
          <label className="flex items-center justify-between text-[10px] text-[#9090a0] cursor-pointer">
            <span>Debug metrics</span>
            <input
              type="checkbox"
              checked={settings.debug}
              onChange={(e) => update({ debug: e.target.checked })}
              className="accent-[#34d399]"
            />
          </label>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { SlidersHorizontal, Circle, Send } from "lucide-react";
import { RgbSliders } from "./RgbSliders";
import { ColorWheelPicker } from "./ColorWheelPicker";
import { CurrentColorPreview } from "./CurrentColorPreview";
import type { ConnectionStatus } from "../types";
import { setColor, throttledSetColor } from "../lampApi";

type PickerMode = "sliders" | "wheel";

interface ColorControlPanelProps {
  r: number;
  g: number;
  b: number;
  brightness: number;
  status: ConnectionStatus;
  liveUpdate: boolean;
  onLiveUpdateChange: (v: boolean) => void;
  onColorChange: (r: number, g: number, b: number, brightness: number) => void;
  onSaveAsPreset: () => void;
}

export function ColorControlPanel({
  r,
  g,
  b,
  brightness,
  status,
  liveUpdate,
  onLiveUpdateChange,
  onColorChange,
  onSaveAsPreset,
}: ColorControlPanelProps) {
  const [mode, setMode] = useState<PickerMode>("sliders");
  const connected = status === "connected";

  const handleChange = (nr: number, ng: number, nb: number, nbr: number) => {
    onColorChange(nr, ng, nb, nbr);
    if (connected && liveUpdate) {
      throttledSetColor(nr, ng, nb, nbr);
    }
  };

  const handleWheelChange = (nr: number, ng: number, nb: number) => {
    handleChange(nr, ng, nb, brightness);
  };

  const handleApply = async () => {
    try {
      await setColor(r, g, b, brightness);
    } catch {
      // error displayed at app level
    }
  };

  return (
    <div className="space-y-3">
      <CurrentColorPreview r={r} g={g} b={b} brightness={brightness} connected={connected} />

      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex rounded-lg border border-[#2e2e38] p-0.5 gap-0.5">
            <button
              onClick={() => setMode("sliders")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "sliders"
                  ? "bg-[#2e2e38] text-[#f0f0f4]"
                  : "text-[#555568] hover:text-[#9090a0]"
              }`}
            >
              <SlidersHorizontal size={11} />
              Sliders
            </button>
            <button
              onClick={() => setMode("wheel")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "wheel"
                  ? "bg-[#2e2e38] text-[#f0f0f4]"
                  : "text-[#555568] hover:text-[#9090a0]"
              }`}
            >
              <Circle size={11} />
              Wheel
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div
              className={`relative h-4 w-7 rounded-full transition-colors ${
                liveUpdate ? "bg-[#ff8040]/80" : "bg-[#2e2e38]"
              }`}
              onClick={() => onLiveUpdateChange(!liveUpdate)}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                  liveUpdate ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-[11px] text-[#9090a0]">Live</span>
          </label>
        </div>

        {mode === "sliders" ? (
          <RgbSliders r={r} g={g} b={b} brightness={brightness} onChange={handleChange} />
        ) : (
          <div className="space-y-3">
            <ColorWheelPicker r={r} g={g} b={b} onChange={handleWheelChange} />
            <div className="border-t border-[#1e1e24] pt-3">
              <RgbSliders
                r={r}
                g={g}
                b={b}
                brightness={brightness}
                onChange={handleChange}
              />
            </div>
          </div>
        )}

        {!liveUpdate && connected && (
          <button
            onClick={handleApply}
            className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#ff8040]/15 py-2 text-xs font-semibold text-[#ff8040] hover:bg-[#ff8040]/25 transition-colors"
          >
            <Send size={11} />
            Apply to Lamp
          </button>
        )}
      </div>

      <button
        onClick={onSaveAsPreset}
        className="w-full rounded-xl border border-[#2e2e38] bg-[#18181c] py-2 text-xs font-medium text-[#9090a0] hover:bg-[#1e1e24] hover:text-[#f0f0f4] transition-colors"
      >
        + Save Current as Preset
      </button>
    </div>
  );
}

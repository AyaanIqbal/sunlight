import { X } from "lucide-react";

interface SettingsModalProps {
  autoConnect: boolean;
  onAutoConnectChange: (v: boolean) => void;
  transitionEnabled: boolean;
  onTransitionEnabledChange: (v: boolean) => void;
  transitionDurationMs: number;
  onTransitionDurationChange: (ms: number) => void;
  onClose: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#f0f0f4]">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-[#555568] leading-relaxed">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#ff8040]/80" : "bg-[#2e2e38]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsModal({
  autoConnect,
  onAutoConnectChange,
  transitionEnabled,
  onTransitionEnabledChange,
  transitionDurationMs,
  onTransitionDurationChange,
  onClose,
}: SettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[400px] rounded-xl border border-[#2e2e38] bg-[#1e1e24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e38]">
          <h2 className="text-sm font-semibold text-[#f0f0f4]">Settings</h2>
          <button
            onClick={onClose}
            className="text-[#555568] hover:text-[#9090a0] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <Toggle
            checked={autoConnect}
            onChange={onAutoConnectChange}
            label="Auto-connect on launch"
            description="Automatically connect to the lamp when the app opens."
          />

          <div className="border-t border-[#2e2e38]" />

          <Toggle
            checked={transitionEnabled}
            onChange={onTransitionEnabledChange}
            label="Smooth transitions"
            description="Fade between colors when selecting a preset."
          />

          {transitionEnabled && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#9090a0]">
                  Transition duration
                </label>
                <span className="text-xs font-mono text-[#555568]">
                  {transitionDurationMs} ms
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={3000}
                step={100}
                value={transitionDurationMs}
                onChange={(e) => onTransitionDurationChange(parseInt(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(90deg, #ff8040 ${((transitionDurationMs - 100) / 2900) * 100}%, #2e2e38 ${((transitionDurationMs - 100) / 2900) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#555568]">100 ms</span>
                <span className="text-[10px] text-[#555568]">3000 ms</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-[#2e2e38]">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#ff8040]/20 px-4 py-2 text-xs font-semibold text-[#ff8040] hover:bg-[#ff8040]/30 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

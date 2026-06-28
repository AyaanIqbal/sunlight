import { clamp } from "../colorUtils";

interface LabeledSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  color: string;
  disabled?: boolean;
  inputMin?: number;
  allowOutOfRangeInput?: boolean;
  onChange: (v: number) => void;
}

export function LabeledSlider({
  label,
  value,
  min,
  max,
  color,
  disabled = false,
  inputMin,
  allowOutOfRangeInput = false,
  onChange,
}: LabeledSliderProps) {
  const pct = ((Math.min(value, max) - min) / (max - min)) * 100;
  const floor = inputMin ?? min;

  const handleNumberChange = (raw: string) => {
    const parsed = parseInt(raw) || floor;
    if (allowOutOfRangeInput) {
      onChange(Math.max(floor, parsed));
    } else {
      onChange(clamp(parsed, min, max));
    }
  };

  return (
    <div className={`flex items-center gap-2.5 ${disabled ? "opacity-50" : ""}`}>
      <span className="w-14 text-[10px] font-medium text-[#9090a0] flex-shrink-0">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={min}
          max={max}
          value={Math.min(Math.max(value, min), max)}
          disabled={disabled}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(90deg, ${color} ${pct}%, #2e2e38 ${pct}%)`,
          }}
        />
      </div>
      <input
        type="number"
        min={floor}
        value={value}
        disabled={disabled}
        onChange={(e) => handleNumberChange(e.target.value)}
        className="w-14 rounded bg-[#1e1e24] border border-[#2e2e38] px-1 py-0.5 text-center text-[11px] font-mono text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, color, onChange }: SliderProps) {
  return (
    <LabeledSlider
      label={label}
      value={value}
      min={min}
      max={max}
      color={color}
      onChange={onChange}
    />
  );
}

interface RgbSlidersProps {
  r: number;
  g: number;
  b: number;
  brightness: number;
  onChange: (r: number, g: number, b: number, brightness: number) => void;
}

export function RgbSliders({ r, g, b, brightness, onChange }: RgbSlidersProps) {
  return (
    <div className="space-y-2">
      <Slider label="R" value={r} min={0} max={255} color="#ef4444" onChange={(v) => onChange(v, g, b, brightness)} />
      <Slider label="G" value={g} min={0} max={255} color="#22c55e" onChange={(v) => onChange(r, v, b, brightness)} />
      <Slider label="B" value={b} min={0} max={255} color="#3b82f6" onChange={(v) => onChange(r, g, v, brightness)} />
      <div className="mt-1 border-t border-[#1e1e24] pt-2">
        <Slider
          label="☀"
          value={brightness}
          min={0}
          max={64}
          color="#ff8040"
          onChange={(v) => onChange(r, g, b, v)}
        />
      </div>
    </div>
  );
}

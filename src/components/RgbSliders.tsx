import { clamp } from "../colorUtils";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, color, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2 text-[11px] font-semibold text-[#9090a0] flex-shrink-0">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(90deg, ${color} ${pct}%, #2e2e38 ${pct}%)`,
          }}
        />
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value) || 0, min, max))}
        className="w-10 rounded bg-[#1e1e24] border border-[#2e2e38] px-1 py-0.5 text-center text-[11px] font-mono text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
      />
    </div>
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

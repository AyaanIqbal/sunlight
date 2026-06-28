import { rgbToHex } from "../colorUtils";

interface CurrentColorPreviewProps {
  r: number;
  g: number;
  b: number;
  brightness: number;
  connected: boolean;
}

export function CurrentColorPreview({ r, g, b, brightness, connected }: CurrentColorPreviewProps) {
  const hex = rgbToHex(r, g, b);
  const dimFactor = brightness / 64;

  const dimmedR = Math.round(r * dimFactor);
  const dimmedG = Math.round(g * dimFactor);
  const dimmedB = Math.round(b * dimFactor);

  return (
    <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] overflow-hidden">
      <div
        className="h-16 w-full transition-colors duration-200 relative"
        style={{ backgroundColor: `rgb(${dimmedR}, ${dimmedG}, ${dimmedB})` }}
      >
        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium text-white/40 bg-black/30 rounded px-2 py-0.5">
              not sending
            </span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-sm border border-white/10 flex-shrink-0"
            style={{ backgroundColor: hex }}
          />
          <span className="text-xs font-mono text-[#9090a0]">{hex}</span>
        </div>
        <div className="text-[10px] text-[#555568] font-mono">
          {r}, {g}, {b} · {brightness}
        </div>
      </div>
    </div>
  );
}

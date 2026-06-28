import Wheel from "@uiw/react-color-wheel";
import { hexToRgb, rgbToHex } from "../colorUtils";

interface ColorWheelPickerProps {
  r: number;
  g: number;
  b: number;
  size?: number;
  showHint?: boolean;
  onChange: (r: number, g: number, b: number) => void;
}

export function ColorWheelPicker({
  r,
  g,
  b,
  size = 180,
  showHint = true,
  onChange,
}: ColorWheelPickerProps) {
  const hex = rgbToHex(r, g, b);

  return (
    <div className="flex flex-col items-center gap-3">
      <Wheel
        color={hex}
        onChange={(color: { hex: string }) => {
          const rgb = hexToRgb(color.hex);
          if (rgb) onChange(rgb.r, rgb.g, rgb.b);
        }}
        width={size}
        height={size}
      />
      {showHint && (
        <p className="text-[10px] text-[#555568]">Brightness controlled separately</p>
      )}
    </div>
  );
}

import Wheel from "@uiw/react-color-wheel";
import { hexToRgb, rgbToHex } from "../colorUtils";

interface ColorWheelPickerProps {
  r: number;
  g: number;
  b: number;
  onChange: (r: number, g: number, b: number) => void;
}

export function ColorWheelPicker({ r, g, b, onChange }: ColorWheelPickerProps) {
  const hex = rgbToHex(r, g, b);

  return (
    <div className="flex flex-col items-center gap-3">
      <Wheel
        color={hex}
        onChange={(color: { hex: string }) => {
          const rgb = hexToRgb(color.hex);
          if (rgb) onChange(rgb.r, rgb.g, rgb.b);
        }}
        width={180}
        height={180}
      />
      <p className="text-[10px] text-[#555568]">Brightness controlled separately</p>
    </div>
  );
}

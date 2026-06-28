import { useRef, useState } from "react";
import { rgbToHex } from "../colorUtils";
import { ColorPickerPopover } from "./ColorPickerPopover";

interface ColorSwatchButtonProps {
  r: number;
  g: number;
  b: number;
  brightness: number;
  connected?: boolean;
  livePreview?: boolean;
  size?: "sm" | "md";
  onChange: (r: number, g: number, b: number, brightness: number) => void;
  onOpenChange?: (open: boolean) => void;
}

const SIZE_CLASSES = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
};

export function ColorSwatchButton({
  r,
  g,
  b,
  brightness,
  connected = false,
  livePreview = true,
  size = "sm",
  onChange,
  onOpenChange,
}: ColorSwatchButtonProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const hex = rgbToHex(r, g, b);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => handleOpenChange(!open)}
        className={`${SIZE_CLASSES[size]} rounded border border-white/10 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#ff8040]/40 transition-shadow`}
        style={{ backgroundColor: hex }}
        title="Pick color"
        aria-label="Pick color"
        aria-expanded={open}
      />

      <ColorPickerPopover
        open={open}
        anchorRef={anchorRef}
        r={r}
        g={g}
        b={b}
        brightness={brightness}
        connected={connected}
        livePreview={livePreview}
        onChange={onChange}
        onClose={() => handleOpenChange(false)}
      />
    </>
  );
}

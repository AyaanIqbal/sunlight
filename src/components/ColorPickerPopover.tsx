import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ColorWheelPicker } from "./ColorWheelPicker";
import { RgbSliders } from "./RgbSliders";
import { throttledSetColor } from "../lampApi";
import { CARET_SIZE, usePopoverPosition } from "../hooks/usePopoverPosition";

interface ColorPickerPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  r: number;
  g: number;
  b: number;
  brightness: number;
  connected: boolean;
  livePreview: boolean;
  onChange: (r: number, g: number, b: number, brightness: number) => void;
  onClose: () => void;
}

export function ColorPickerPopover({
  open,
  anchorRef,
  r,
  g,
  b,
  brightness,
  connected,
  livePreview,
  onChange,
  onClose,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const position = usePopoverPosition(open, anchorRef, popoverRef);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, onClose, anchorRef]);

  const handleChange = (nr: number, ng: number, nb: number, nbr: number) => {
    onChange(nr, ng, nb, nbr);
    if (connected && livePreview) {
      throttledSetColor(nr, ng, nb, nbr);
    }
  };

  const handleWheelChange = (nr: number, ng: number, nb: number) => {
    handleChange(nr, ng, nb, brightness);
  };

  if (!open) return null;

  const placement = position?.placement ?? "below";
  const style: CSSProperties = position
    ? { top: position.top, left: position.left }
    : { top: -9999, left: -9999, visibility: "hidden" };

  const caretStyle: CSSProperties = position
    ? { left: position.caretLeft - CARET_SIZE }
    : { left: "50%" };

  const stopPointer = (e: ReactPointerEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[60] w-[280px] rounded-xl border border-[#2e2e38] bg-[#1e1e24] shadow-2xl"
      style={style}
      role="dialog"
      aria-label="Color picker"
      data-no-dnd
      onPointerDown={stopPointer}
      onPointerDownCapture={stopPointer}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {placement === "below" && (
        <div
          className="absolute -top-2 h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-[#2e2e38]"
          style={caretStyle}
        />
      )}

      <div className="relative p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 rounded p-1 text-[#555568] hover:text-[#9090a0] transition-colors z-10"
          aria-label="Close color picker"
        >
          <X size={14} />
        </button>

        <div className="pt-1 pb-3 flex justify-center">
          <ColorWheelPicker r={r} g={g} b={b} onChange={handleWheelChange} size={160} showHint={false} />
        </div>

        <RgbSliders r={r} g={g} b={b} brightness={brightness} onChange={handleChange} />
      </div>

      {placement === "above" && (
        <div
          className="absolute -bottom-2 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-[#2e2e38]"
          style={caretStyle}
        />
      )}
    </div>,
    document.body
  );
}

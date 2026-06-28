import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LampPreset } from "../types";
import { gradientStyle } from "../presets";
import { rgbToHex } from "../colorUtils";

interface PresetCardProps {
  preset: LampPreset;
  active: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

interface MenuPos {
  x: number;
  y: number;
}

export function PresetCard({ preset, active, onActivate, onEdit, onDelete }: PresetCardProps) {
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const justDraggedRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: preset.id });

  useEffect(() => {
    if (isDragging) justDraggedRef.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const hex = rgbToHex(preset.r, preset.g, preset.b);

  const handleClick = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onActivate();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenuPos(null);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group relative rounded-lg border transition-all cursor-grab active:cursor-grabbing overflow-hidden ${
          active
            ? "border-[#ff8040]/60 bg-[#ff8040]/5"
            : "border-[#2e2e38] bg-[#202028] hover:border-[#3e3e4e] hover:bg-[#252530]"
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Gradient strip — expands in on hover/active, collapses to nothing otherwise */}
        <div
          className={`w-full overflow-hidden transition-[height] duration-200 ease-out ${
            active ? "h-1.5" : "h-0 group-hover:h-1.5"
          }`}
          style={{ background: gradientStyle(preset) }}
        />

        <div className="px-3 py-2.5 flex items-center gap-2">
          {/* Drag affordance */}
          <div className="flex-shrink-0 text-[#2e2e38] group-hover:text-[#555568] pointer-events-none">
            <GripVertical size={12} />
          </div>

          {/* Color swatch */}
          <div
            className="h-6 w-6 rounded flex-shrink-0 border border-white/10"
            style={{ backgroundColor: hex }}
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#f0f0f4] truncate">{preset.name}</p>
            <p className="text-[10px] text-[#555568] font-mono">
              {preset.r},{preset.g},{preset.b} · {preset.brightness}
            </p>
          </div>
        </div>
      </div>

      {/* Right-click context menu — rendered at cursor position */}
      {menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div
            className="fixed z-50 w-36 rounded-lg border border-[#2e2e38] bg-[#1e1e24] py-1 shadow-2xl"
            style={{ top: menuPos.y, left: menuPos.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { closeMenu(); onEdit(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#9090a0] hover:bg-[#2e2e38] hover:text-[#f0f0f4] transition-colors"
            >
              <Pencil size={11} />
              Edit
            </button>
            <button
              onClick={() => { closeMenu(); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#f87171] hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={11} />
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}

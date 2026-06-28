import { useEffect, useRef, useState } from "react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AmbientConfig } from "../types";
import { formatConfigSummary } from "../ambientConfigUtils";

interface AmbientConfigCardProps {
  config: AmbientConfig;
  active: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

interface MenuPos {
  x: number;
  y: number;
}

export function AmbientConfigCard({
  config,
  active,
  onApply,
  onEdit,
  onDelete,
}: AmbientConfigCardProps) {
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const justDraggedRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: config.id });

  useEffect(() => {
    if (isDragging) justDraggedRef.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleClick = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onApply();
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
            ? "border-[#34d399]/60 bg-[#34d399]/5"
            : "border-[#2e2e38] bg-[#202028] hover:border-[#3e3e4e] hover:bg-[#252530]"
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`w-full overflow-hidden transition-[height] duration-200 ease-out ${
            active ? "h-1.5 bg-[#34d399]/40" : "h-0 group-hover:h-1.5 group-hover:bg-[#34d399]/20"
          }`}
        />

        <div className="px-3 py-2.5 flex items-center gap-2">
          <div className="flex-shrink-0 text-[#2e2e38] group-hover:text-[#555568] pointer-events-none">
            <GripVertical size={12} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#f0f0f4] truncate">{config.name}</p>
            <p className="text-[10px] text-[#555568] truncate">
              {formatConfigSummary(config.settings)}
            </p>
          </div>
        </div>
      </div>

      {menuPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeMenu();
            }}
          />
          <div
            className="fixed z-50 w-40 rounded-lg border border-[#2e2e38] bg-[#1e1e24] py-1 shadow-2xl"
            style={{ top: menuPos.y, left: menuPos.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                closeMenu();
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#9090a0] hover:bg-[#2e2e38] hover:text-[#f0f0f4] transition-colors"
            >
              <Pencil size={11} />
              Edit Config
            </button>
            <button
              onClick={() => {
                closeMenu();
                onDelete();
              }}
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

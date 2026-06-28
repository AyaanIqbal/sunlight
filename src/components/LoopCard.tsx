import { useEffect, useRef, useState } from "react";
import { Copy, Pencil, Trash2, GripVertical, RotateCw } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LampLoop } from "../types";
import { formatDurationMs, loopTimelineGradient, loopTotalDurationMs } from "../loopUtils";

interface LoopCardProps {
  loop: LampLoop;
  active: boolean;
  running: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

interface MenuPos {
  x: number;
  y: number;
}

export function LoopCard({
  loop,
  active,
  running,
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
}: LoopCardProps) {
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const justDraggedRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: loop.id });

  useEffect(() => {
    if (isDragging) justDraggedRef.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const totalMs = loopTotalDurationMs(loop);

  const handleClick = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onRun();
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
          running
            ? "border-[#60a5fa]/60 bg-[#60a5fa]/5 ring-1 ring-[#60a5fa]/20"
            : active
              ? "border-[#ff8040]/60 bg-[#ff8040]/5"
              : "border-[#2e2e38] bg-[#202028] hover:border-[#3e3e4e] hover:bg-[#252530]"
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`w-full overflow-hidden transition-[height] duration-200 ease-out relative ${
            running || active ? "h-2" : "h-1 group-hover:h-2"
          }`}
          style={{ background: loopTimelineGradient(loop) }}
        >
          {running && (
            <div className="absolute inset-0 flex items-center justify-end pr-1">
              <RotateCw size={10} className="text-white/70 animate-spin" />
            </div>
          )}
        </div>

        <div className="px-3 py-2.5 flex items-center gap-2">
          <div className="flex-shrink-0 text-[#2e2e38] group-hover:text-[#555568] pointer-events-none">
            <GripVertical size={12} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-[#f0f0f4] truncate">{loop.name}</p>
              {running && (
                <span className="flex-shrink-0 rounded bg-[#60a5fa]/20 px-1 py-0.5 text-[9px] font-semibold text-[#60a5fa] uppercase">
                  Running
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#555568]">
              {loop.steps.length} steps · {formatDurationMs(totalMs)}
            </p>
            {loop.notes && (
              <p className="text-[10px] text-[#555568] truncate mt-0.5">{loop.notes}</p>
            )}
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
            className="fixed z-50 w-36 rounded-lg border border-[#2e2e38] bg-[#1e1e24] py-1 shadow-2xl"
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
              Edit
            </button>
            <button
              onClick={() => {
                closeMenu();
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#9090a0] hover:bg-[#2e2e38] hover:text-[#f0f0f4] transition-colors"
            >
              <Copy size={11} />
              Duplicate
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

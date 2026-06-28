import { useState } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { LampPreset, PresetSection as PresetSectionType } from "../types";
import { PresetCard } from "./PresetCard";

interface PresetSectionProps {
  section: PresetSectionType;
  presets: LampPreset[];
  activePresetId: string | null;
  canDelete: boolean;
  onToggleCollapse: () => void;
  onActivate: (preset: LampPreset) => void;
  onEdit: (preset: LampPreset) => void;
  onDelete: (preset: LampPreset) => void;
  onRename: () => void;
  onDeleteSection: () => void;
}

interface MenuPos {
  x: number;
  y: number;
}

export function PresetSection({
  section,
  presets,
  activePresetId,
  canDelete,
  onToggleCollapse,
  onActivate,
  onEdit,
  onDelete,
  onRename,
  onDeleteSection,
}: PresetSectionProps) {
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const { setNodeRef } = useDroppable({ id: section.id });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenuPos(null);

  return (
    <>
    <div className="space-y-1">
      {/* Section header */}
      <button
        onClick={onToggleCollapse}
        onContextMenu={handleContextMenu}
        className="flex w-full items-center gap-1.5 px-1 py-1 rounded-md hover:bg-[#1e1e24] transition-colors min-w-0"
      >
        <ChevronRight
          size={13}
          className={`flex-shrink-0 text-[#555568] transition-transform ${
            section.collapsed ? "" : "rotate-90"
          }`}
        />
        <span className="text-xs font-semibold text-[#9090a0] truncate">{section.name}</span>
        <span className="text-[10px] text-[#555568] flex-shrink-0">({presets.length})</span>
      </button>

      {/* Preset cards */}
      {!section.collapsed && (
        <div ref={setNodeRef} className="space-y-1 pl-2 min-h-[2px]">
          <SortableContext items={section.presetIds} strategy={verticalListSortingStrategy}>
            {presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                active={preset.id === activePresetId}
                onActivate={() => onActivate(preset)}
                onEdit={() => onEdit(preset)}
                onDelete={() => onDelete(preset)}
              />
            ))}
          </SortableContext>
          {presets.length === 0 && (
            <p className="py-2 text-center text-[10px] text-[#555568]">
              No presets. Drag here or create one.
            </p>
          )}
        </div>
      )}
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
              onRename();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#9090a0] hover:bg-[#2e2e38] hover:text-[#f0f0f4] transition-colors"
          >
            <Pencil size={11} />
            Rename
          </button>
          {canDelete && (
            <button
              onClick={() => {
                closeMenu();
                onDeleteSection();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#f87171] hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={11} />
              Delete Section
            </button>
          )}
        </div>
      </>
    )}
    </>
  );
}

import { useState } from "react";
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const { setNodeRef } = useDroppable({ id: section.id });

  return (
    <div className="space-y-1">
      {/* Section header */}
      <div className="flex items-center gap-1 group">
        <button
          onClick={onToggleCollapse}
          className="flex flex-1 items-center gap-1.5 px-1 py-1 rounded-md hover:bg-[#1e1e24] transition-colors min-w-0"
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

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded p-1 text-[#555568] hover:text-[#9090a0] hover:bg-[#1e1e24] opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal size={13} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 w-36 rounded-lg border border-[#2e2e38] bg-[#1e1e24] py-1 shadow-xl">
                <button
                  onClick={() => { setMenuOpen(false); onRename(); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#9090a0] hover:bg-[#2e2e38] hover:text-[#f0f0f4] transition-colors"
                >
                  <Pencil size={11} />
                  Rename
                </button>
                {canDelete && (
                  <button
                    onClick={() => { setMenuOpen(false); onDeleteSection(); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#f87171] hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={11} />
                    Delete Section
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

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
  );
}

import { useState, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus, FolderPlus } from "lucide-react";
import type { LampPreset, PresetSection } from "../types";
import { PresetSection as PresetSectionComp } from "./PresetSection";
import { PresetEditorModal } from "./PresetEditorModal";
import { SectionEditorModal } from "./SectionEditorModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { gradientStyle } from "../presets";

interface PresetPanelProps {
  presets: LampPreset[];
  sections: PresetSection[];
  activePresetId: string | null;
  currentR: number;
  currentG: number;
  currentB: number;
  currentBrightness: number;
  connected?: boolean;
  onActivate: (preset: LampPreset) => void;
  onPresetsChange: (presets: LampPreset[]) => void;
  onSectionsChange: (sections: PresetSection[]) => void;
  onToast?: (message: string, variant?: "info" | "error") => void;
  embedded?: boolean;
  externalModal?: "newPreset" | "newSection" | null;
  onExternalModalHandled?: () => void;
}

type ModalState =
  | { type: "newPreset" }
  | { type: "editPreset"; preset: LampPreset }
  | { type: "newSection" }
  | { type: "renameSection"; section: PresetSection }
  | { type: "deletePreset"; preset: LampPreset }
  | { type: "deleteSection"; section: PresetSection }
  | null;

export function PresetPanel({
  presets,
  sections,
  activePresetId,
  currentR,
  currentG,
  currentB,
  currentBrightness,
  connected = false,
  onActivate,
  onPresetsChange,
  onSectionsChange,
  onToast,
  embedded = false,
  externalModal,
  onExternalModalHandled,
}: PresetPanelProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [dragOverlayPreset, setDragOverlayPreset] = useState<LampPreset | null>(null);

  useEffect(() => {
    if (!externalModal) return;
    if (externalModal === "newPreset") setModal({ type: "newPreset" });
    if (externalModal === "newSection") setModal({ type: "newSection" });
    onExternalModalHandled?.();
  }, [externalModal, onExternalModalHandled]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const showToast = (msg: string, variant: "info" | "error" = "info") => {
    if (onToast) {
      onToast(msg, variant);
      return;
    }
    setLocalToast(msg);
    setTimeout(() => setLocalToast(null), 3000);
  };

  const defaultSectionId = sections[0]?.id ?? "";

  // --- Preset CRUD ---
  const handleSavePreset = (preset: LampPreset, sectionId: string) => {
    const isEdit = presets.some((p) => p.id === preset.id);

    let newPresets: LampPreset[];
    let newSections = [...sections];

    if (isEdit) {
      newPresets = presets.map((p) => (p.id === preset.id ? preset : p));
      // Move between sections if section changed
      const oldSection = sections.find((s) => s.presetIds.includes(preset.id));
      if (oldSection && oldSection.id !== sectionId) {
        newSections = newSections.map((s) => {
          if (s.id === oldSection.id) return { ...s, presetIds: s.presetIds.filter((id) => id !== preset.id) };
          if (s.id === sectionId) return { ...s, presetIds: [...s.presetIds, preset.id] };
          return s;
        });
      }
    } else {
      newPresets = [...presets, preset];
      newSections = newSections.map((s) =>
        s.id === sectionId ? { ...s, presetIds: [...s.presetIds, preset.id] } : s
      );
    }

    onPresetsChange(newPresets);
    onSectionsChange(newSections);
    setModal(null);
  };

  const handleDeletePreset = (preset: LampPreset) => {
    onPresetsChange(presets.filter((p) => p.id !== preset.id));
    onSectionsChange(
      sections.map((s) => ({ ...s, presetIds: s.presetIds.filter((id) => id !== preset.id) }))
    );
    setModal(null);
  };

  // --- Section CRUD ---
  const handleCreateSection = (name: string) => {
    const now = new Date().toISOString();
    const newSection: PresetSection = {
      id: crypto.randomUUID(),
      name,
      collapsed: false,
      presetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    onSectionsChange([...sections, newSection]);
    setModal(null);
  };

  const handleRenameSection = (section: PresetSection, name: string) => {
    onSectionsChange(
      sections.map((s) =>
        s.id === section.id ? { ...s, name, updatedAt: new Date().toISOString() } : s
      )
    );
    setModal(null);
  };

  const handleDeleteSection = (section: PresetSection) => {
    // Move presets to default section
    const fallbackId = sections.find((s) => s.id !== section.id)?.id ?? "";
    onSectionsChange(
      sections
        .filter((s) => s.id !== section.id)
        .map((s) =>
          s.id === fallbackId
            ? { ...s, presetIds: [...s.presetIds, ...section.presetIds] }
            : s
        )
    );
    setModal(null);
    showToast(`Presets from "${section.name}" moved to "${sections.find((s) => s.id === fallbackId)?.name ?? "another section"}".`);
  };

  const handleToggleCollapse = (section: PresetSection) => {
    onSectionsChange(
      sections.map((s) =>
        s.id === section.id ? { ...s, collapsed: !s.collapsed } : s
      )
    );
  };

  // --- Drag and drop ---
  const handleDragStart = (event: { active: { id: string | number } }) => {
    const preset = presets.find((p) => p.id === event.active.id);
    setDragOverlayPreset(preset ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeSection = sections.find((s) => s.presetIds.includes(activeId));
    const overSection = sections.find((s) => s.presetIds.includes(overId)) ??
      sections.find((s) => s.id === overId);

    if (!activeSection || !overSection) return;
    if (activeSection.id === overSection.id) return;

    // Move to a new section
    onSectionsChange(
      sections.map((s) => {
        if (s.id === activeSection.id) return { ...s, presetIds: s.presetIds.filter((id) => id !== activeId) };
        if (s.id === overSection.id) {
          const overIndex = s.presetIds.indexOf(overId);
          const newIds = [...s.presetIds];
          if (overIndex >= 0) newIds.splice(overIndex, 0, activeId);
          else newIds.push(activeId);
          return { ...s, presetIds: newIds };
        }
        return s;
      })
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragOverlayPreset(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeSection = sections.find((s) => s.presetIds.includes(activeId));
    if (!activeSection) return;

    const oldIndex = activeSection.presetIds.indexOf(activeId);
    const newIndex = activeSection.presetIds.indexOf(overId);
    if (newIndex < 0) return;

    onSectionsChange(
      sections.map((s) =>
        s.id === activeSection.id
          ? { ...s, presetIds: arrayMove(s.presetIds, oldIndex, newIndex) }
          : s
      )
    );
  };

  return (
    <div className="h-full flex flex-col flex-1 min-h-0">
      {!embedded && (
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h2 className="text-xs font-semibold text-[#9090a0] uppercase tracking-wider">Presets</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setModal({ type: "newSection" })}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#555568] hover:text-[#9090a0] hover:bg-[#1e1e24] transition-colors"
              title="New section"
            >
              <FolderPlus size={12} />
            </button>
            <button
              onClick={() => setModal({ type: "newPreset" })}
              className="flex items-center gap-1.5 rounded-lg bg-[#ff8040]/15 px-2.5 py-1 text-xs font-medium text-[#ff8040] hover:bg-[#ff8040]/25 transition-colors"
            >
              <Plus size={12} />
              New Preset
            </button>
          </div>
        </div>
      )}

      {/* Scrollable sections list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {sections.map((section) => {
            const sectionPresets = section.presetIds
              .map((id) => presets.find((p) => p.id === id))
              .filter((p): p is LampPreset => !!p);

            return (
              <PresetSectionComp
                key={section.id}
                section={section}
                presets={sectionPresets}
                activePresetId={activePresetId}
                canDelete={sections.length > 1}
                onToggleCollapse={() => handleToggleCollapse(section)}
                onActivate={onActivate}
                onEdit={(p) => setModal({ type: "editPreset", preset: p })}
                onDelete={(p) => setModal({ type: "deletePreset", preset: p })}
                onRename={() => setModal({ type: "renameSection", section })}
                onDeleteSection={() => setModal({ type: "deleteSection", section })}
              />
            );
          })}

          <DragOverlay>
            {dragOverlayPreset && (
              <div className="rounded-lg border border-[#ff8040]/40 bg-[#202028] opacity-90 px-3 py-2 shadow-xl">
                <div
                  className="h-1.5 rounded-full mb-2"
                  style={{ background: gradientStyle(dragOverlayPreset) }}
                />
                <p className="text-xs font-medium text-[#f0f0f4]">{dragOverlayPreset.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {sections.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-sm text-[#555568]">No sections yet.</p>
            <button
              onClick={() => setModal({ type: "newSection" })}
              className="mt-2 text-xs text-[#ff8040] hover:text-[#ff9050]"
            >
              Create a section
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {!onToast && localToast && (
        <div className="mt-2 rounded-lg bg-[#1e1e24] border border-[#2e2e38] px-3 py-2 text-xs text-[#9090a0] flex-shrink-0">
          {localToast}
        </div>
      )}

      {/* Modals */}
      <PresetEditorModal
        open={modal?.type === "newPreset"}
        sections={sections}
        defaultSectionId={defaultSectionId}
        currentR={currentR}
        currentG={currentG}
        currentB={currentB}
        currentBrightness={currentBrightness}
        connected={connected}
        onSave={handleSavePreset}
        onCancel={() => setModal(null)}
      />

      <PresetEditorModal
        open={modal?.type === "editPreset"}
        preset={modal?.type === "editPreset" ? modal.preset : undefined}
        sections={sections}
        defaultSectionId={defaultSectionId}
        connected={connected}
        onSave={handleSavePreset}
        onCancel={() => setModal(null)}
      />

      <SectionEditorModal
        open={modal?.type === "newSection"}
        onSave={handleCreateSection}
        onCancel={() => setModal(null)}
      />

      <SectionEditorModal
        open={modal?.type === "renameSection"}
        initialName={modal?.type === "renameSection" ? modal.section.name : ""}
        onSave={(name) => {
          if (modal?.type === "renameSection") handleRenameSection(modal.section, name);
        }}
        onCancel={() => setModal(null)}
      />

      <ConfirmDialog
        open={modal?.type === "deletePreset"}
        title={
          modal?.type === "deletePreset" ? `Delete "${modal.preset.name}"?` : ""
        }
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (modal?.type === "deletePreset") handleDeletePreset(modal.preset);
        }}
        onCancel={() => setModal(null)}
      />

      <ConfirmDialog
        open={modal?.type === "deleteSection"}
        title={
          modal?.type === "deleteSection" ? `Delete section "${modal.section.name}"?` : ""
        }
        message={
          modal?.type === "deleteSection"
            ? `The ${modal.section.presetIds.length} preset(s) inside will be moved to the next available section.`
            : ""
        }
        confirmLabel="Delete Section"
        danger
        onConfirm={() => {
          if (modal?.type === "deleteSection") handleDeleteSection(modal.section);
        }}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}

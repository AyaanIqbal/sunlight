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
import type { LampLoop, LoopSection } from "../types";
import { LoopSection as LoopSectionComp } from "./LoopSection";
import { LoopEditorModal } from "./LoopEditorModal";
import { SectionEditorModal } from "./SectionEditorModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { loopTimelineGradient } from "../loopUtils";
import type { LampPreset } from "../types";
import { duplicateLoop, getDefaultLoopSectionId, makeLoopSection, DEFAULT_LOOP_SECTION_NAME } from "../loops";

interface LoopPanelProps {
  loops: LampLoop[];
  loopSections: LoopSection[];
  presets: LampPreset[];
  activeLoopId: string | null;
  runningLoopId: string | null;
  currentR: number;
  currentG: number;
  currentB: number;
  currentBrightness: number;
  connected: boolean;
  onRun: (loop: LampLoop) => void;
  onLoopsChange: (loops: LampLoop[]) => void;
  onLoopSectionsChange: (sections: LoopSection[]) => void;
  onToast?: (message: string, variant?: "info" | "error") => void;
  onLoopEdited?: (loopId: string) => void;
  externalModal?: "newLoop" | "newSection" | null;
  onExternalModalHandled?: () => void;
}

type ModalState =
  | { type: "newLoop" }
  | { type: "editLoop"; loop: LampLoop }
  | { type: "newSection" }
  | { type: "renameSection"; section: LoopSection }
  | { type: "deleteLoop"; loop: LampLoop }
  | { type: "deleteSection"; section: LoopSection }
  | null;

export function LoopPanel({
  loops,
  loopSections,
  presets,
  activeLoopId,
  runningLoopId,
  currentR,
  currentG,
  currentB,
  currentBrightness,
  connected,
  onRun,
  onLoopsChange,
  onLoopSectionsChange,
  onToast,
  onLoopEdited,
  externalModal,
  onExternalModalHandled,
}: LoopPanelProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [dragOverlayLoop, setDragOverlayLoop] = useState<LampLoop | null>(null);

  useEffect(() => {
    if (!externalModal) return;
    if (externalModal === "newLoop") setModal({ type: "newLoop" });
    if (externalModal === "newSection") setModal({ type: "newSection" });
    onExternalModalHandled?.();
  }, [externalModal, onExternalModalHandled]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const showToast = (msg: string, variant: "info" | "error" = "info") => {
    onToast?.(msg, variant);
  };

  const defaultSectionId = getDefaultLoopSectionId(loopSections);

  const handleSaveLoop = (loop: LampLoop, sectionId: string) => {
    const isEdit = loops.some((l) => l.id === loop.id);
    let newLoops: LampLoop[];
    let newSections = [...loopSections];

    let resolvedSectionId = sectionId || getDefaultLoopSectionId(newSections);
    if (!resolvedSectionId || !newSections.some((s) => s.id === resolvedSectionId)) {
      const myLoops = makeLoopSection(DEFAULT_LOOP_SECTION_NAME);
      newSections = [myLoops, ...newSections];
      resolvedSectionId = myLoops.id;
    }

    const savedLoop: LampLoop = { ...loop, sectionId: resolvedSectionId };

    if (isEdit) {
      newLoops = loops.map((l) => (l.id === savedLoop.id ? savedLoop : l));
      onLoopEdited?.(savedLoop.id);
      const oldSection = loopSections.find((s) => s.loopIds.includes(savedLoop.id));
      if (oldSection && oldSection.id !== resolvedSectionId) {
        newSections = newSections.map((s) => {
          if (s.id === oldSection.id) return { ...s, loopIds: s.loopIds.filter((id) => id !== savedLoop.id) };
          if (s.id === resolvedSectionId) return { ...s, loopIds: [...s.loopIds, savedLoop.id] };
          return s;
        });
      }
    } else {
      newLoops = [...loops, savedLoop];
      newSections = newSections.map((s) =>
        s.id === resolvedSectionId ? { ...s, loopIds: [...s.loopIds, savedLoop.id] } : s
      );
    }

    onLoopsChange(newLoops);
    onLoopSectionsChange(newSections);
    setModal(null);
  };

  const handleDeleteLoop = (loop: LampLoop) => {
    onLoopsChange(loops.filter((l) => l.id !== loop.id));
    onLoopSectionsChange(
      loopSections.map((s) => ({ ...s, loopIds: s.loopIds.filter((id) => id !== loop.id) }))
    );
    setModal(null);
  };

  const handleDuplicateLoop = (loop: LampLoop) => {
    const copy = duplicateLoop(loop);
    onLoopsChange([...loops, copy]);
    onLoopSectionsChange(
      loopSections.map((s) =>
        s.id === copy.sectionId ? { ...s, loopIds: [...s.loopIds, copy.id] } : s
      )
    );
    showToast(`Duplicated "${loop.name}".`);
  };

  const handleCreateSection = (name: string) => {
    onLoopSectionsChange([...loopSections, makeLoopSection(name)]);
    setModal(null);
  };

  const handleRenameSection = (section: LoopSection, name: string) => {
    onLoopSectionsChange(
      loopSections.map((s) =>
        s.id === section.id ? { ...s, name, updatedAt: new Date().toISOString() } : s
      )
    );
    setModal(null);
  };

  const handleDeleteSection = (section: LoopSection) => {
    const fallbackId = loopSections.find((s) => s.id !== section.id)?.id ?? "";
    onLoopSectionsChange(
      loopSections
        .filter((s) => s.id !== section.id)
        .map((s) =>
          s.id === fallbackId
            ? { ...s, loopIds: [...s.loopIds, ...section.loopIds] }
            : s
        )
    );
    setModal(null);
    showToast(
      `Loops from "${section.name}" moved to "${loopSections.find((s) => s.id === fallbackId)?.name ?? "another section"}".`
    );
  };

  const handleToggleCollapse = (section: LoopSection) => {
    onLoopSectionsChange(
      loopSections.map((s) =>
        s.id === section.id ? { ...s, collapsed: !s.collapsed } : s
      )
    );
  };

  const handleDragStart = (event: { active: { id: string | number } }) => {
    const loop = loops.find((l) => l.id === event.active.id);
    setDragOverlayLoop(loop ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeSection = loopSections.find((s) => s.loopIds.includes(activeId));
    const overSection =
      loopSections.find((s) => s.loopIds.includes(overId)) ??
      loopSections.find((s) => s.id === overId);

    if (!activeSection || !overSection || activeSection.id === overSection.id) return;

    onLoopSectionsChange(
      loopSections.map((s) => {
        if (s.id === activeSection.id) return { ...s, loopIds: s.loopIds.filter((id) => id !== activeId) };
        if (s.id === overSection.id) {
          const overIndex = s.loopIds.indexOf(overId);
          const newIds = [...s.loopIds];
          if (overIndex >= 0) newIds.splice(overIndex, 0, activeId);
          else newIds.push(activeId);
          return { ...s, loopIds: newIds };
        }
        return s;
      })
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragOverlayLoop(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeSection = loopSections.find((s) => s.loopIds.includes(activeId));
    if (!activeSection) return;

    const oldIndex = activeSection.loopIds.indexOf(activeId);
    const newIndex = activeSection.loopIds.indexOf(overId);
    if (newIndex < 0) return;

    onLoopSectionsChange(
      loopSections.map((s) =>
        s.id === activeSection.id
          ? { ...s, loopIds: arrayMove(s.loopIds, oldIndex, newIndex) }
          : s
      )
    );
  };

  return (
    <div className="h-full flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {loopSections.map((section) => {
            const sectionLoops = section.loopIds
              .map((id) => loops.find((l) => l.id === id))
              .filter((l): l is LampLoop => !!l);

            return (
              <LoopSectionComp
                key={section.id}
                section={section}
                loops={sectionLoops}
                activeLoopId={activeLoopId}
                runningLoopId={runningLoopId}
                canDelete={loopSections.length > 1}
                onToggleCollapse={() => handleToggleCollapse(section)}
                onRun={onRun}
                onEdit={(l) => setModal({ type: "editLoop", loop: l })}
                onDuplicate={handleDuplicateLoop}
                onDelete={(l) => setModal({ type: "deleteLoop", loop: l })}
                onRename={() => setModal({ type: "renameSection", section })}
                onDeleteSection={() => setModal({ type: "deleteSection", section })}
              />
            );
          })}

          <DragOverlay>
            {dragOverlayLoop && (
              <div className="rounded-lg border border-[#60a5fa]/40 bg-[#202028] opacity-90 px-3 py-2 shadow-xl">
                <div
                  className="h-1.5 rounded-full mb-2"
                  style={{ background: loopTimelineGradient(dragOverlayLoop) }}
                />
                <p className="text-xs font-medium text-[#f0f0f4]">{dragOverlayLoop.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {loopSections.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-sm text-[#555568]">No loops yet.</p>
            <p className="text-xs text-[#555568] mt-1">
              Create your first loop to cycle through colors continuously.
            </p>
          </div>
        )}
      </div>

      <LoopEditorModal
        open={modal?.type === "newLoop"}
        loopSections={loopSections}
        presets={presets}
        defaultSectionId={defaultSectionId}
        currentR={currentR}
        currentG={currentG}
        currentB={currentB}
        currentBrightness={currentBrightness}
        connected={connected}
        onSave={handleSaveLoop}
        onCancel={() => setModal(null)}
      />

      <LoopEditorModal
        open={modal?.type === "editLoop"}
        loop={modal?.type === "editLoop" ? modal.loop : undefined}
        loopSections={loopSections}
        presets={presets}
        defaultSectionId={defaultSectionId}
        currentR={currentR}
        currentG={currentG}
        currentB={currentB}
        currentBrightness={currentBrightness}
        connected={connected}
        onSave={handleSaveLoop}
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
        open={modal?.type === "deleteLoop"}
        title={modal?.type === "deleteLoop" ? `Delete "${modal.loop.name}"?` : ""}
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (modal?.type === "deleteLoop") handleDeleteLoop(modal.loop);
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
            ? `The ${modal.section.loopIds.length} loop(s) inside will be moved to the next available section.`
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

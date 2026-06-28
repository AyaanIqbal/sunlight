import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical, Plus, Eye, RotateCw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { LampLoop, LampPreset, LoopSection, LoopStep, TransitionType } from "../types";
import { Modal } from "./Modal";
import { SelectField } from "./SelectField";
import { ColorSwatchButton } from "./ColorSwatchButton";
import { LabeledSlider } from "./RgbSliders";
import { clamp, rgbToHex } from "../colorUtils";
import { makeEmptyStep } from "../loops";
import { isValidLoop } from "../loopUtils";
import { previewStepColor } from "../loopRunner";

interface LoopEditorModalProps {
  open: boolean;
  loop?: LampLoop;
  loopSections: LoopSection[];
  presets: LampPreset[];
  defaultSectionId: string;
  currentR: number;
  currentG: number;
  currentB: number;
  currentBrightness: number;
  connected: boolean;
  onSave: (loop: LampLoop, sectionId: string) => void;
  onCancel: () => void;
}

function TransitionConnector({
  step,
  onChange,
  isReturnTransition,
}: {
  step: LoopStep;
  onChange: (step: LoopStep) => void;
  isReturnTransition?: boolean;
}) {
  const isInstant = step.transitionType === "instant";

  return (
    <div className="flex items-stretch gap-2 px-3">
      <div className="w-px bg-[#3e3e4e] self-stretch shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 pt-3 pb-3 space-y-2">
        {isReturnTransition && (
          <p className="text-[10px] text-[#555568]">Transition back to start</p>
        )}
        <LabeledSlider
          label="Hold (ms)"
          value={step.holdMs}
          min={100}
          max={10000}
          inputMin={100}
          allowOutOfRangeInput
          color="#60a5fa"
          onChange={(holdMs) => onChange({ ...step, holdMs: Math.max(100, holdMs) })}
        />
        <LabeledSlider
          label="Transition (ms)"
          value={step.transitionToNextMs}
          min={0}
          max={5000}
          inputMin={0}
          allowOutOfRangeInput
          color="#ff8040"
          disabled={isInstant}
          onChange={(transitionToNextMs) =>
            onChange({ ...step, transitionToNextMs: Math.max(0, transitionToNextMs) })
          }
        />
        <div>
          <label className="block text-[10px] text-[#555568] mb-1">Transition</label>
          <SelectField
            value={step.transitionType}
            onChange={(v) => {
              const transitionType = v as TransitionType;
              if (transitionType === "instant") {
                onChange({ ...step, transitionType, transitionToNextMs: 0 });
              } else {
                onChange({
                  ...step,
                  transitionType,
                  transitionToNextMs: step.transitionToNextMs || 1200,
                });
              }
            }}
            options={[
              { value: "smooth", label: "Smooth" },
              { value: "instant", label: "Instant" },
            ]}
            size="compact"
          />
        </div>
      </div>
    </div>
  );
}

function StepColorCard({
  step,
  index,
  onChange,
  onRemove,
  onPreview,
  connected,
  canRemove,
  onPickerOpenChange,
  dragAttributes,
  dragListeners,
}: {
  step: LoopStep;
  index: number;
  onChange: (step: LoopStep) => void;
  onRemove: () => void;
  onPreview: () => void;
  connected: boolean;
  canRemove: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
}) {
  const cardDragListeners = dragListeners
    ? {
        ...dragListeners,
        onPointerDown: (e: ReactPointerEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest("input, button, textarea, [data-no-dnd]")) return;
          dragListeners.onPointerDown?.(e);
        },
      }
    : undefined;

  return (
    <div
      {...dragAttributes}
      {...cardDragListeners}
      className="rounded-lg border border-[#2e2e38] bg-[#18181c] p-3 space-y-2 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 text-[#555568] pointer-events-none">
          <GripVertical size={14} />
        </div>
        <span className="text-[10px] font-semibold text-[#555568] w-5">#{index + 1}</span>
        <div data-no-dnd>
          <ColorSwatchButton
            r={step.r}
            g={step.g}
            b={step.b}
            brightness={step.brightness}
            connected={connected}
            livePreview
            onChange={(r, g, b, brightness) => onChange({ ...step, r, g, b, brightness })}
            onOpenChange={onPickerOpenChange}
          />
        </div>
        <input
          type="text"
          data-no-dnd
          value={step.name ?? ""}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          placeholder={`Step ${index + 1}`}
          className="flex-1 rounded bg-[#111114] border border-[#2e2e38] px-2 py-1 text-xs text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
        />
        <button
          type="button"
          data-no-dnd
          onClick={onPreview}
          title={connected ? "Preview on lamp" : "Preview (not connected)"}
          className="rounded p-1 text-[#555568] hover:text-[#9090a0] disabled:opacity-40"
        >
          <Eye size={13} />
        </button>
        {canRemove && (
          <button
            type="button"
            data-no-dnd
            onClick={onRemove}
            className="text-[#555568] hover:text-[#f87171] text-xs"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "R", key: "r" as const, max: 255 },
          { label: "G", key: "g" as const, max: 255 },
          { label: "B", key: "b" as const, max: 255 },
          { label: "Br", key: "brightness" as const, max: 64 },
        ].map(({ label, key, max }) => (
          <div key={key}>
            <label className="text-[10px] text-[#555568]">{label}</label>
            <input
              type="number"
              data-no-dnd
              min={0}
              max={max}
              value={step[key]}
              onChange={(e) =>
                onChange({ ...step, [key]: clamp(parseInt(e.target.value) || 0, 0, max) })
              }
              className="w-full rounded bg-[#111114] border border-[#2e2e38] px-1.5 py-1 text-xs font-mono text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableStepRow({
  step,
  index,
  isLast,
  onChange,
  onRemove,
  onPreview,
  connected,
  canRemove,
}: {
  step: LoopStep;
  index: number;
  isLast: boolean;
  onChange: (step: LoopStep) => void;
  onRemove: () => void;
  onPreview: () => void;
  connected: boolean;
  canRemove: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: step.id,
    disabled: pickerOpen,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StepColorCard
        step={step}
        index={index}
        connected={connected}
        canRemove={canRemove}
        onChange={onChange}
        onRemove={onRemove}
        onPreview={onPreview}
        onPickerOpenChange={setPickerOpen}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
      <TransitionConnector
        step={step}
        onChange={onChange}
        isReturnTransition={isLast}
      />
    </div>
  );
}

function AddStepActions({
  presets,
  currentR,
  currentG,
  currentB,
  currentBrightness,
  onAddFromColor,
  onAddCustom,
}: {
  presets: LampPreset[];
  currentR: number;
  currentG: number;
  currentB: number;
  currentBrightness: number;
  onAddFromColor: (r: number, g: number, b: number, brightness: number, name?: string) => void;
  onAddCustom: () => void;
}) {
  const [presetPickerValue, setPresetPickerValue] = useState("");

  return (
    <div className="flex justify-end gap-1 py-2">
      <button
          type="button"
          onClick={() =>
            onAddFromColor(currentR, currentG, currentB, currentBrightness, "Current color")
          }
          className="rounded px-2 py-0.5 text-[10px] text-[#ff8040] hover:bg-[#ff8040]/10"
        >
          + Current color
        </button>
        <SelectField
          value={presetPickerValue}
          onChange={(id) => {
            const preset = presets.find((p) => p.id === id);
            if (preset) {
              onAddFromColor(preset.r, preset.g, preset.b, preset.brightness, preset.name);
            }
            setPresetPickerValue("");
          }}
          options={presets.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="+ From preset"
          size="compact"
          className="max-w-[120px]"
        />
        <button
          type="button"
          onClick={onAddCustom}
          className="flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] text-[#9090a0] hover:bg-[#2e2e38]"
        >
          <Plus size={10} />
        Custom
      </button>
    </div>
  );
}

function GhostReturnRow({ firstStep }: { firstStep: LoopStep }) {
  const hex = rgbToHex(firstStep.r, firstStep.g, firstStep.b);
  return (
    <div className="rounded-lg border border-dashed border-[#3e3e4e] bg-[#18181c]/50 p-3 opacity-80">
      <div className="flex items-center gap-2">
        <RotateCw size={13} className="text-[#555568] flex-shrink-0" />
        <div
          className="h-5 w-5 rounded border border-white/10 flex-shrink-0"
          style={{ backgroundColor: hex }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#9090a0]">Back to start</p>
          <p className="text-[10px] text-[#555568] truncate">
            Loops to {firstStep.name || "first step"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoopEditorModal({
  open,
  loop,
  loopSections,
  presets,
  defaultSectionId,
  currentR,
  currentG,
  currentB,
  currentBrightness,
  connected,
  onSave,
  onCancel,
}: LoopEditorModalProps) {
  const isEdit = !!loop;
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [sectionId, setSectionId] = useState(defaultSectionId);
  const [steps, setSteps] = useState<LoopStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (!open) return;
    setName(loop?.name ?? "");
    setNotes(loop?.notes ?? "");
    setSectionId(loop?.sectionId ?? defaultSectionId);
    setSteps(loop?.steps.length ? loop.steps.map((s) => ({ ...s })) : [makeEmptyStep(), makeEmptyStep()]);
    setError(null);
    setPreviewMsg(null);
  }, [open, loop, defaultSectionId]);

  useEffect(() => {
    if (isEdit && loop) setSectionId(loop.sectionId);
  }, [isEdit, loop]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setSteps(arrayMove(steps, oldIndex, newIndex));
  };

  const addStepFromColor = (r: number, g: number, b: number, brightness: number, stepName?: string) => {
    setSteps([
      ...steps,
      {
        ...makeEmptyStep(),
        name: stepName,
        r,
        g,
        b,
        brightness,
      },
    ]);
  };

  const handleSave = () => {
    const validationError = isValidLoop({ name, steps });
    if (validationError) {
      setError(validationError);
      return;
    }
    const now = new Date().toISOString();
    const saved: LampLoop = {
      id: loop?.id ?? uuidv4(),
      name: name.trim(),
      steps,
      notes: notes.trim() || undefined,
      sectionId: sectionId || defaultSectionId,
      createdAt: loop?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved, sectionId || defaultSectionId);
  };

  const handlePreview = async (step: LoopStep) => {
    if (!connected) {
      setPreviewMsg("Not connected — color updated in UI only.");
      return;
    }
    const result = await previewStepColor(step);
    setPreviewMsg(result.sent ? "Preview sent to lamp." : "Could not send preview to lamp.");
    setTimeout(() => setPreviewMsg(null), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      panelClassName="w-[540px] max-h-[90vh] rounded-xl border border-[#2e2e38] bg-[#1e1e24] shadow-2xl flex flex-col"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e38] flex-shrink-0">
        <h2 className="text-sm font-semibold text-[#f0f0f4]">
          {isEdit ? "Edit Loop" : "New Loop"}
        </h2>
        <button onClick={onCancel} className="text-[#555568] hover:text-[#9090a0]">
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className="block text-[11px] font-medium text-[#9090a0] mb-1">Loop name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Loop name*"
            className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-sm text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
          />
        </div>

        <SelectField
          label="Section"
          value={sectionId}
          onChange={setSectionId}
          options={loopSections.map((s) => ({ value: s.id, label: s.name }))}
        />

        <div>
          <label className="block text-[11px] font-medium text-[#9090a0] mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-xs text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#9090a0] mb-2">Steps</label>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0">
                {steps.map((step, index) => (
                  <SortableStepRow
                    key={step.id}
                    step={step}
                    index={index}
                    isLast={index === steps.length - 1}
                    connected={connected}
                    canRemove={steps.length > 2}
                    onChange={(updated) =>
                      setSteps(steps.map((s) => (s.id === updated.id ? updated : s)))
                    }
                    onRemove={() => setSteps(steps.filter((s) => s.id !== step.id))}
                    onPreview={() => void handlePreview(step)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {steps.length > 0 && (
            <>
              <AddStepActions
                presets={presets}
                currentR={currentR}
                currentG={currentG}
                currentB={currentB}
                currentBrightness={currentBrightness}
                onAddFromColor={addStepFromColor}
                onAddCustom={() => setSteps([...steps, makeEmptyStep()])}
              />
              <GhostReturnRow firstStep={steps[0]} />
            </>
          )}
        </div>

        {error && <p className="text-xs text-[#f87171]">{error}</p>}
        {previewMsg && <p className="text-xs text-[#9090a0]">{previewMsg}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2e2e38] flex-shrink-0">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090a0] hover:bg-[#2e2e38] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || steps.length < 2}
          className="rounded-lg bg-[#ff8040]/20 px-4 py-2 text-xs font-semibold text-[#ff8040] hover:bg-[#ff8040]/30 disabled:opacity-40 transition-colors"
        >
          {isEdit ? "Save Changes" : "Create Loop"}
        </button>
      </div>
    </Modal>
  );
}

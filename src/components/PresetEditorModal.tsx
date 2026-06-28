import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { LampPreset, PresetSection } from "../types";
import { clamp, defaultGradient, rgbToHex } from "../colorUtils";
import { SelectField } from "./SelectField";
import { Modal } from "./Modal";
import { v4 as uuidv4 } from "uuid";

interface PresetEditorModalProps {
  open: boolean;
  preset?: LampPreset;
  sections: PresetSection[];
  defaultSectionId: string;
  currentR?: number;
  currentG?: number;
  currentB?: number;
  currentBrightness?: number;
  onSave: (preset: LampPreset, sectionId: string) => void;
  onCancel: () => void;
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-5 w-5 rounded border border-white/10 flex-shrink-0"
        style={{ backgroundColor: value }}
      />
      <label className="text-[11px] text-[#9090a0] w-16 flex-shrink-0">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#RRGGBB"
        maxLength={7}
        className="flex-1 rounded bg-[#111114] border border-[#2e2e38] px-2 py-1 text-xs font-mono text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
      />
      <input
        type="color"
        value={value.length === 7 ? value : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
      />
    </div>
  );
}

export function PresetEditorModal({
  open,
  preset,
  sections,
  defaultSectionId,
  currentR = 255,
  currentG = 128,
  currentB = 0,
  currentBrightness = 64,
  onSave,
  onCancel,
}: PresetEditorModalProps) {
  const isEdit = !!preset;

  const [name, setName] = useState(preset?.name ?? "");
  const [r, setR] = useState(preset?.r ?? currentR);
  const [g, setG] = useState(preset?.g ?? currentG);
  const [b, setB] = useState(preset?.b ?? currentB);
  const [brightness, setBrightness] = useState(preset?.brightness ?? currentBrightness);
  const [sectionId, setSectionId] = useState(preset ? "" : defaultSectionId);
  const [notes, setNotes] = useState(preset?.notes ?? "");

  const initGradient = preset?.gradient ?? defaultGradient(
    preset?.r ?? currentR,
    preset?.g ?? currentG,
    preset?.b ?? currentB
  );
  const [borderColor, setBorderColor] = useState(initGradient.borderColor);
  const [mainColor, setMainColor] = useState(initGradient.mainColor);
  const [middleColor, setMiddleColor] = useState(initGradient.middleColor);

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setName(preset?.name ?? "");
    setR(preset?.r ?? currentR);
    setG(preset?.g ?? currentG);
    setB(preset?.b ?? currentB);
    setBrightness(preset?.brightness ?? currentBrightness);
    setSectionId(preset ? "" : defaultSectionId);
    setNotes(preset?.notes ?? "");
    const gradient = preset?.gradient ?? defaultGradient(
      preset?.r ?? currentR,
      preset?.g ?? currentG,
      preset?.b ?? currentB
    );
    setBorderColor(gradient.borderColor);
    setMainColor(gradient.mainColor);
    setMiddleColor(gradient.middleColor);
  }, [open, preset, currentR, currentG, currentB, currentBrightness, defaultSectionId]);

  // Find which section contains this preset
  useEffect(() => {
    if (isEdit && preset) {
      const sec = sections.find((s) => s.presetIds.includes(preset.id));
      if (sec) setSectionId(sec.id);
    }
  }, [isEdit, preset, sections]);

  const handleSave = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const saved: LampPreset = {
      id: preset?.id ?? uuidv4(),
      name: name.trim(),
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      brightness: clamp(brightness, 0, 64),
      gradient: { borderColor, mainColor, middleColor },
      notes: notes.trim() || undefined,
      createdAt: preset?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved, sectionId || defaultSectionId);
  };

  const derivedHex = rgbToHex(r, g, b);
  const gradientPreview = `linear-gradient(90deg, ${borderColor}, ${mainColor}, ${middleColor})`;

  const syncGradientToColor = () => {
    const hex = rgbToHex(r, g, b);
    setBorderColor(hex);
    setMainColor(hex);
    setMiddleColor(hex);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      panelClassName="w-[440px] rounded-xl border border-[#2e2e38] bg-[#1e1e24] shadow-2xl"
    >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e38]">
          <h2 className="text-sm font-semibold text-[#f0f0f4]">
            {isEdit ? "Edit Preset" : "New Preset"}
          </h2>
          <button
            onClick={onCancel}
            className="text-[#555568] hover:text-[#9090a0] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Gradient preview */}
          <div
            className="h-10 rounded-lg border border-white/5"
            style={{ background: gradientPreview }}
          />

          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-[#9090a0] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Preset name"
              autoFocus
              className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-sm text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
            />
          </div>

          {/* RGB + Brightness */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "R (0–255)", value: r, setter: setR, max: 255 },
              { label: "G (0–255)", value: g, setter: setG, max: 255 },
              { label: "B (0–255)", value: b, setter: setB, max: 255 },
              { label: "Brightness (0–64)", value: brightness, setter: setBrightness, max: 64 },
            ].map(({ label, value, setter, max }) => (
              <div key={label}>
                <label className="block text-[11px] text-[#9090a0] mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={value}
                  onChange={(e) => setter(clamp(parseInt(e.target.value) || 0, 0, max))}
                  className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-2 py-1.5 text-sm font-mono text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 rounded border border-white/10"
              style={{ backgroundColor: derivedHex }}
            />
            <span className="text-[11px] font-mono text-[#555568]">{derivedHex}</span>
          </div>

          {/* Section */}
          <SelectField
            label="Section"
            value={sectionId}
            onChange={setSectionId}
            options={sections.map((s) => ({ value: s.id, label: s.name }))}
          />

          {/* Gradient colors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-[#9090a0]">Gradient Preview</label>
              <button
                onClick={syncGradientToColor}
                className="text-[10px] text-[#ff8040] hover:text-[#ff9050]"
              >
                Sync to color
              </button>
            </div>
            <div className="space-y-1.5">
              <ColorInput label="Border" value={borderColor} onChange={setBorderColor} />
              <ColorInput label="Main" value={mainColor} onChange={setMainColor} />
              <ColorInput label="Middle" value={middleColor} onChange={setMiddleColor} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium text-[#9090a0] mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this preset…"
              rows={2}
              className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-xs text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2e2e38]">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090a0] hover:bg-[#2e2e38] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-lg bg-[#ff8040]/20 px-4 py-2 text-xs font-semibold text-[#ff8040] hover:bg-[#ff8040]/30 disabled:opacity-40 transition-colors"
          >
            {isEdit ? "Save Changes" : "Create Preset"}
          </button>
        </div>
    </Modal>
  );
}

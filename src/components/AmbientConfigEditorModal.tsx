import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AmbientSettings } from "../types";
import { mergeAmbientSettings } from "../ambientDefaults";
import { Modal } from "./Modal";
import { AmbientSettingsForm } from "./AmbientSettingsForm";

interface AmbientConfigEditorModalProps {
  open: boolean;
  mode: "save" | "edit";
  initialName?: string;
  initialSettings: AmbientSettings;
  onSave: (name: string, settings: AmbientSettings) => void;
  onCancel: () => void;
  onValidationError?: (message: string) => void;
}

export function AmbientConfigEditorModal({
  open,
  mode,
  initialName = "",
  initialSettings,
  onSave,
  onCancel,
  onValidationError,
}: AmbientConfigEditorModalProps) {
  const [name, setName] = useState(initialName);
  const [draftSettings, setDraftSettings] = useState<AmbientSettings>(initialSettings);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDraftSettings(mergeAmbientSettings(initialSettings));
  }, [open, initialName, initialSettings]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      onValidationError?.("Config name is required.");
      return;
    }
    onSave(trimmed, mergeAmbientSettings(draftSettings));
  };

  return (
    <Modal open={open} onClose={onCancel} panelClassName="w-full max-w-lg">
      <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2e2e38] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#f0f0f4]">
            {mode === "save" ? "Save Config" : "Edit Config"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#555568] hover:text-[#f0f0f4] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#9090a0]">Config name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Movie Night"
              className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-xs text-[#f0f0f4] focus:outline-none focus:border-[#34d399]/50"
            />
          </div>

          <AmbientSettingsForm
            settings={draftSettings}
            onChange={setDraftSettings}
            showDebug
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[#2e2e38] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs text-[#9090a0] hover:text-[#f0f0f4] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[#34d399]/15 px-3 py-1.5 text-xs font-medium text-[#34d399] hover:bg-[#34d399]/25 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

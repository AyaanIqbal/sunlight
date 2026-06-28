import { useState } from "react";
import { X } from "lucide-react";

interface SectionEditorModalProps {
  initialName?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export function SectionEditorModal({ initialName = "", onSave, onCancel }: SectionEditorModalProps) {
  const [name, setName] = useState(initialName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-72 rounded-xl border border-[#2e2e38] bg-[#1e1e24] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#f0f0f4]">
            {initialName ? "Rename Section" : "New Section"}
          </h2>
          <button onClick={onCancel} className="text-[#555568] hover:text-[#9090a0]">
            <X size={16} />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
          placeholder="Section name"
          autoFocus
          className="w-full rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-sm text-[#f0f0f4] focus:outline-none focus:border-[#ff8040]/50 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#9090a0] hover:bg-[#2e2e38] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) onSave(name.trim()); }}
            disabled={!name.trim()}
            className="rounded-lg bg-[#ff8040]/20 px-3 py-1.5 text-xs font-semibold text-[#ff8040] hover:bg-[#ff8040]/30 disabled:opacity-40 transition-colors"
          >
            {initialName ? "Rename" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

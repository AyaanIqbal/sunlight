import { useState } from "react";
import { Plus, FolderPlus, Square } from "lucide-react";
import type { LampLoop, LampPreset, LoopSection, PresetSection, WorkspaceTab } from "../types";
import { PresetPanel } from "./PresetPanel";
import { LoopPanel } from "./LoopPanel";

type ExternalModal =
  | { tab: "presets"; action: "newPreset" | "newSection" }
  | { tab: "loops"; action: "newLoop" | "newSection" }
  | null;

interface RightWorkspacePanelProps {
  workspace: WorkspaceTab;
  onWorkspaceChange: (tab: WorkspaceTab) => void;
  presets: LampPreset[];
  sections: PresetSection[];
  loops: LampLoop[];
  loopSections: LoopSection[];
  activePresetId: string | null;
  activeLoopId: string | null;
  runningLoopId: string | null;
  runningLoopName: string | null;
  currentR: number;
  currentG: number;
  currentB: number;
  currentBrightness: number;
  connected: boolean;
  onActivatePreset: (preset: LampPreset) => void;
  onRunLoop: (loop: LampLoop) => void;
  onStopLoop: () => void;
  onPresetsChange: (presets: LampPreset[]) => void;
  onSectionsChange: (sections: PresetSection[]) => void;
  onLoopsChange: (loops: LampLoop[]) => void;
  onLoopSectionsChange: (sections: LoopSection[]) => void;
  onLoopEdited: (loopId: string) => void;
  onToast?: (message: string, variant?: "info" | "error") => void;
}

export function RightWorkspacePanel({
  workspace,
  onWorkspaceChange,
  presets,
  sections,
  loops,
  loopSections,
  activePresetId,
  activeLoopId,
  runningLoopId,
  runningLoopName,
  currentR,
  currentG,
  currentB,
  currentBrightness,
  connected,
  onActivatePreset,
  onRunLoop,
  onStopLoop,
  onPresetsChange,
  onSectionsChange,
  onLoopsChange,
  onLoopSectionsChange,
  onLoopEdited,
  onToast,
}: RightWorkspacePanelProps) {
  const [externalModal, setExternalModal] = useState<ExternalModal>(null);

  const triggerModal = (action: ExternalModal) => {
    setExternalModal(action);
  };

  const presetExternal =
    externalModal?.tab === "presets" ? externalModal.action : null;
  const loopExternal =
    externalModal?.tab === "loops" ? externalModal.action : null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <div className="flex rounded-lg border border-[#2e2e38] p-0.5 gap-0.5">
          {(["presets", "loops"] as WorkspaceTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onWorkspaceChange(tab)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                workspace === tab
                  ? "bg-[#2e2e38] text-[#f0f0f4]"
                  : "text-[#555568] hover:text-[#9090a0]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {runningLoopName && (
          <div className="flex items-center gap-2 flex-1 min-w-0 ml-1">
            <span className="text-[10px] text-[#60a5fa] truncate">
              Running: {runningLoopName}
            </span>
            <button
              onClick={onStopLoop}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#f87171] hover:bg-red-500/10 flex-shrink-0"
            >
              <Square size={9} />
              Stop
            </button>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() =>
              triggerModal(
                workspace === "presets"
                  ? { tab: "presets", action: "newSection" }
                  : { tab: "loops", action: "newSection" }
              )
            }
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#555568] hover:text-[#9090a0] hover:bg-[#1e1e24] transition-colors"
            title="New section"
          >
            <FolderPlus size={12} />
          </button>
          <button
            onClick={() =>
              triggerModal(
                workspace === "presets"
                  ? { tab: "presets", action: "newPreset" }
                  : { tab: "loops", action: "newLoop" }
              )
            }
            className="flex items-center gap-1.5 rounded-lg bg-[#ff8040]/15 px-2.5 py-1 text-xs font-medium text-[#ff8040] hover:bg-[#ff8040]/25 transition-colors"
          >
            <Plus size={12} />
            {workspace === "presets" ? "New Preset" : "New Loop"}
          </button>
        </div>
      </div>

      {workspace === "presets" ? (
        <PresetPanel
          embedded
          presets={presets}
          sections={sections}
          activePresetId={activePresetId}
          currentR={currentR}
          currentG={currentG}
          currentB={currentB}
          currentBrightness={currentBrightness}
          connected={connected}
          onActivate={onActivatePreset}
          onPresetsChange={onPresetsChange}
          onSectionsChange={onSectionsChange}
          onToast={onToast}
          externalModal={presetExternal ?? null}
          onExternalModalHandled={() => setExternalModal(null)}
        />
      ) : (
        <LoopPanel
          loops={loops}
          loopSections={loopSections}
          presets={presets}
          activeLoopId={activeLoopId}
          runningLoopId={runningLoopId}
          currentR={currentR}
          currentG={currentG}
          currentB={currentB}
          currentBrightness={currentBrightness}
          connected={connected}
          onRun={onRunLoop}
          onLoopsChange={onLoopsChange}
          onLoopSectionsChange={onLoopSectionsChange}
          onLoopEdited={onLoopEdited}
          onToast={onToast}
          externalModal={loopExternal ?? null}
          onExternalModalHandled={() => setExternalModal(null)}
        />
      )}
    </div>
  );
}

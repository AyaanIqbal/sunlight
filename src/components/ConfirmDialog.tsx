import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      panelClassName="w-80 rounded-xl border border-[#2e2e38] bg-[#1e1e24] p-5 shadow-2xl"
    >
      <h3 className="mb-1 text-sm font-semibold text-[#f0f0f4]">{title}</h3>
      <p className="mb-5 text-xs text-[#9090a0] leading-relaxed">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#9090a0] hover:bg-[#2e2e38] transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            danger
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-[#ff8040]/20 text-[#ff8040] hover:bg-[#ff8040]/30"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

import { useEffect, useState, type ReactNode } from "react";

const DURATION_MS = 220;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}

export function Modal({ open, onClose, children, panelClassName = "" }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = setTimeout(() => setShouldRender(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/60 ease-out ${
          visible ? "opacity-100 backdrop-blur-sm" : "opacity-0 backdrop-blur-none"
        }`}
        style={{
          transitionProperty: "opacity, backdrop-filter",
          transitionDuration: `${DURATION_MS}ms`,
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 max-h-[90vh] overflow-y-auto transition-all ease-out ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-[0.97] translate-y-2"
        } ${panelClassName}`}
        style={{ transitionDuration: `${DURATION_MS}ms` }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

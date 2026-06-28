import { useCallback, useEffect, useState } from "react";

interface ToastState {
  message: string;
  variant: "info" | "error";
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, variant: "info" | "error" = "info") => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, showToast };
}

interface ToastProps {
  toast: ToastState | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg border px-4 py-2 text-xs shadow-2xl max-w-md ${
        toast.variant === "error"
          ? "border-red-500/30 bg-[#1e1e24] text-[#f87171]"
          : "border-[#2e2e38] bg-[#1e1e24] text-[#9090a0]"
      }`}
    >
      {toast.message}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-[11px] font-medium text-[#9090a0] mb-1">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-sm text-[#f0f0f4] hover:border-[#3e3e4e] focus:outline-none focus:border-[#ff8040]/50 transition-colors"
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-[#555568] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-[#2e2e38] bg-[#1e1e24] py-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors ${
                option.value === value
                  ? "bg-[#ff8040]/10 text-[#ff8040]"
                  : "text-[#f0f0f4] hover:bg-[#2e2e38]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

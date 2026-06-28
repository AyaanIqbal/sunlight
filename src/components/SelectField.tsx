import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  size?: "default" | "compact";
  placeholder?: string;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  size = "default",
  placeholder = "Select…",
  className = "",
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const isCompact = size === "compact";

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

  const triggerClass = isCompact
    ? "flex w-full items-center justify-between rounded bg-[#111114] border border-[#2e2e38] px-1.5 py-1 text-[10px] text-[#f0f0f4] hover:border-[#3e3e4e] focus:outline-none focus:border-[#ff8040]/50 transition-colors"
    : "flex w-full items-center justify-between rounded-lg bg-[#111114] border border-[#2e2e38] px-3 py-2 text-sm text-[#f0f0f4] hover:border-[#3e3e4e] focus:outline-none focus:border-[#ff8040]/50 transition-colors";

  const menuClass = isCompact
    ? "absolute z-20 mt-1 w-full rounded border border-[#2e2e38] bg-[#1e1e24] py-0.5 shadow-xl"
    : "absolute z-20 mt-1 w-full rounded-lg border border-[#2e2e38] bg-[#1e1e24] py-1 shadow-xl";

  const optionClass = (active: boolean) =>
    isCompact
      ? `flex w-full px-2 py-1 text-left text-[10px] transition-colors ${
          active ? "bg-[#ff8040]/10 text-[#ff8040]" : "text-[#f0f0f4] hover:bg-[#2e2e38]"
        }`
      : `flex w-full px-3 py-1.5 text-left text-sm transition-colors ${
          active ? "bg-[#ff8040]/10 text-[#ff8040]" : "text-[#f0f0f4] hover:bg-[#2e2e38]"
        }`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-medium text-[#9090a0] mb-1">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        <span className={`truncate ${!selected ? "text-[#9090a0]" : ""}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={isCompact ? 10 : 14}
          className={`flex-shrink-0 text-[#555568] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className={menuClass}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={optionClass(option.value === value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

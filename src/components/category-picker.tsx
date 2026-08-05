"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Icon } from "./icon";

export type CategoryOption = { value: string; description: string };

export function CategoryPicker({ categories, value, onChange }: { categories: CategoryOption[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeLabel = hovered ?? value;
  const activeOption = categories.find((c) => c.value === activeLabel) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-2 rounded-[10px] border bg-white px-3.5 text-left text-[15px] transition-colors ${value ? "text-[#14241c]" : "text-[#9aa1ab]"} ${open ? "border-[#7fae93] shadow-[0_0_0_3px_rgba(31,107,70,0.12)]" : "border-[#dfe2e6] hover:border-[#7fae93]"}`}
          style={{ height: 46 }}
        >
          <span className="truncate">{value || "Select category"}</span>
          <ChevronDownIcon className={`h-4 w-4 shrink-0 text-[#6b756d] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[#dfe2e6] bg-white shadow-lift"
            >
              <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Submission category">
                {categories.map((category) => {
                  const isSelected = value === category.value;
                  const isHovered = hovered === category.value;
                  return (
                    <button
                      type="button"
                      key={category.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(category.value);
                        setOpen(false);
                      }}
                      onMouseEnter={() => setHovered(category.value)}
                      onMouseLeave={() => setHovered((h) => (h === category.value ? null : h))}
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-[#f0f6f2] font-semibold text-[#214d37]"
                          : isHovered
                            ? "bg-[#f7fbf9] text-[#14241c]"
                            : "text-[#14241c]"
                      }`}
                    >
                      <span>{category.value}</span>
                      {isSelected && <Icon name="check" className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="rounded-xl border border-[#e6e9ec] bg-parchment p-3.5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#214d37]">{activeLabel || "Submission category"}</p>
        <p className="mt-1 text-sm leading-relaxed text-[#3d4740]">
          {activeOption ? activeOption.description : "Hover or select a category to see what it includes."}
        </p>
      </div>
    </div>
  );
}
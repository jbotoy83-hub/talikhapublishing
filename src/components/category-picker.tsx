"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Icon } from "./icon";

export type CategoryOption = { value: string; description: string; custom?: boolean };

export function CategoryPicker({
  categories,
  value,
  onChange,
  locked = false,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [lockedWarn, setLockedWarn] = useState(false);
  const [customActive, setCustomActive] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const customOption = categories.find((c) => c.custom) ?? null;
  const activeLabel = hovered ?? value;
  const activeOption = categories.find((c) => c.value === activeLabel) ?? null;

  useEffect(() => {
    setCustomActive(false);
    setCustomDraft("");
  }, [categories]);

  useEffect(() => {
    if (!locked) setLockedWarn(false);
  }, [locked]);

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
          onClick={() => {
            if (locked) {
              setLockedWarn(true);
              return;
            }
            setOpen((o) => !o);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-2 rounded-[10px] border bg-white px-3.5 text-left text-[15px] transition-colors ${value ? "text-[#14241c]" : "text-[#9aa1ab]"} ${
            lockedWarn
              ? "border-[#c95b3c] shadow-[0_0_0_3px_rgba(201,91,60,0.12)]"
              : open
                ? "border-[#7fae93] shadow-[0_0_0_3px_rgba(31,107,70,0.12)]"
                : "border-[#dfe2e6] hover:border-[#7fae93]"
          }`}
          style={{ height: 46 }}
        >
          <span className="truncate">{value || (locked ? "Select a journal first" : "Select category")}</span>
          <ChevronDownIcon className={`h-4 w-4 shrink-0 text-[#6b756d] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {lockedWarn && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#c95b3c]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            Select a journal first to choose a category.
          </p>
        )}

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
                  const isSelected = value === category.value || (category.custom && customActive);
                  const isHovered = hovered === category.value;
                  return (
                    <button
                      type="button"
                      key={category.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (category.custom) {
                          setCustomActive(true);
                          setCustomDraft(value && value !== category.value ? value : "");
                          onChange(category.value);
                        } else {
                          setCustomActive(false);
                          onChange(category.value);
                        }
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

      {customActive && customOption ? (
        <div className="rounded-xl border border-[#e6e9ec] bg-parchment p-3.5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#214d37]">{customOption.value}</p>
          <input
            type="text"
            value={customDraft}
            onChange={(event) => {
              setCustomDraft(event.target.value);
              onChange(event.target.value.trim() || customOption.value);
            }}
            placeholder="Type the specific category"
            className="mt-2 w-full rounded-lg border border-[#dfe2e6] bg-white px-3 py-2 text-sm text-[#14241c] placeholder:text-[#9aa1ab] focus:border-[#7fae93] focus:outline-none focus:ring-[3px] focus:ring-[#1f6b46]/10"
          />
          <p className="mt-1.5 text-sm leading-relaxed text-[#3d4740]">{customOption.description}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e6e9ec] bg-parchment p-3.5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#214d37]">{activeLabel || "Submission category"}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#3d4740]">
            {locked ? "Choose a journal first — categories are matched to the journal you select." : activeOption ? activeOption.description : "Hover or select a category to see what it includes."}
          </p>
        </div>
      )}
    </div>
  );
}
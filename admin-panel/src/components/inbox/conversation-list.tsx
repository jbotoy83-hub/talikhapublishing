import { useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Star,
  ChevronDown,
} from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BRAND_MARKS } from "./brand-icons";
import { IconPaperclip } from "./inbox-icons";
import { relativeTime } from "./format";
import type { Conversation, SortKey } from "./types";

const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  unread: "Unread first",
};

interface ListProps {
  title: string;
  conversations: Conversation[];
  selectedId: string | null;
  search: string;
  sort: SortKey;
  onSelect: (id: string) => void;
  onSearch: (value: string) => void;
  onSort: (sort: SortKey) => void;
  onToggleStar: (id: string) => void;
  onOpenChannels: () => void;
}

export function ConversationList({
  title,
  conversations,
  selectedId,
  search,
  sort,
  onSelect,
  onSearch,
  onSort,
  onToggleStar,
  onOpenChannels,
}: ListProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="ibx-list">
      <div className="ibx-list__head">
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button type="button" className="ibx-iconbtn ibx-channels-btn" aria-label="Channels" onClick={onOpenChannels}>
            <ChevronDown size={18} />
          </button>
          <h2 className="ibx-list__title">{title}</h2>
        </div>
        <div className="ibx-list__head-actions">
          <button type="button" className="ibx-iconbtn" aria-label="New message" title="New message">
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <label className="ibx-search">
        <Search size={16} />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search messages"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <span className="ibx-search__kbd">/</span>
      </label>

      <div className="ibx-sort">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">
              {SORT_LABEL[sort]}
              <ChevronDown size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <DropdownMenuItem key={key} onSelect={() => onSort(key)}>
                {SORT_LABEL[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="ibx-scroll">
        <div className="ibx-rows">
          {conversations.length === 0 && (
            <div className="ibx-empty" style={{ padding: "48px 24px" }}>
              <p>No conversations match this view.</p>
            </div>
          )}
          {conversations.map((c) => {
            const Mark = BRAND_MARKS[c.channelKind];
            const unread = c.unread > 0;
            return (
              <button
                key={c.id}
                type="button"
                className="ibx-row"
                data-active={selectedId === c.id}
                data-unread={unread}
                onClick={() => onSelect(c.id)}
              >
                <span className="ibx-avatar" style={{ background: c.participant.accent }}>
                  {c.participant.initials}
                  <span
                    style={{
                      position: "absolute",
                      left: -2,
                      bottom: -2,
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: "#fff",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                    }}
                  >
                    <Mark size={11} />
                  </span>
                </span>

                <span className="ibx-row__body">
                  <span className="ibx-row__top">
                    <span className="ibx-row__name">{c.participant.name}</span>
                    <span className="ibx-row__time">{relativeTime(c.lastMessageAt)}</span>
                  </span>
                  <span className="ibx-row__preview">{c.preview}</span>
                </span>

                <span className="ibx-row__meta">
                  <span className="ibx-row__icons">
                    {c.hasAttachment && <IconPaperclip size={14} />}
                    <span
                      role="button"
                      tabIndex={0}
                      className="ibx-row__star"
                      data-on={c.starred}
                      aria-label="Toggle star"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(c.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onToggleStar(c.id);
                        }
                      }}
                    >
                      <Star size={15} strokeWidth={1.9} />
                    </span>
                  </span>
                  {unread && <span className="ibx-unread-dot" />}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}

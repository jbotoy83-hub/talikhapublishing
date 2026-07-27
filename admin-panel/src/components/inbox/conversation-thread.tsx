import { useEffect, useRef } from "react";
import { ChevronLeft, Search, MoreVertical } from "@/components/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconFilter,
  IconPhone,
  IconPaperclip,
  IconClock,
  IconCheckCheck,
  IconReply,
} from "./inbox-icons";
import { MessageComposer } from "./message-composer";
import { clockTime, dayLabel } from "./format";
import type { Conversation } from "./types";

const ME = { initials: "NS", accent: "#183d2c" };

const PRESENCE_TEXT: Record<string, string> = {
  online: "Active now",
  recent: "last seen recently",
  offline: "Offline",
};

function windowState(c: Conversation): "closing" | "closed" | null {
  if (c.channelKind !== "messenger" || !c.messengerWindowExpiresAt) return null;
  const left = new Date(c.messengerWindowExpiresAt).getTime() - Date.now();
  if (left <= 0) return "closed";
  if (left < 2 * 3_600_000) return "closing";
  return null;
}

interface ThreadProps {
  conversation: Conversation | null;
  onBack: () => void;
  onSend: (text: string) => void;
}

export function ConversationThread({ conversation, onBack, onSend }: ThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.id, conversation?.messages.length]);

  if (!conversation) {
    return (
      <section className="ibx-thread">
        <div className="ibx-empty">
          <span className="ibx-empty__mark">
            <IconReply size={22} />
          </span>
          <h3>Select a conversation</h3>
          <p>Choose a thread from the list to read the full exchange and reply from one place.</p>
        </div>
      </section>
    );
  }

  const c = conversation;
  const ws = windowState(c);
  const composerDisabled = ws === "closed";

  let lastDay = "";

  return (
    <section className="ibx-thread">
      <header className="ibx-thread__head">
        <div className="ibx-thread__who">
          <button type="button" className="ibx-iconbtn ibx-back" aria-label="Back" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <span className="ibx-avatar ibx-avatar--lg" style={{ background: c.participant.accent }}>
            {c.participant.initials}
            <span className="ibx-presence" data-presence={c.participant.presence} />
          </span>
          <span className="ibx-thread__id">
            <span className="ibx-thread__name">{c.participant.name}</span>
            <span className="ibx-thread__pres">
              <span className="ibx-dot" data-presence={c.participant.presence} />
              {PRESENCE_TEXT[c.participant.presence]}
            </span>
          </span>
        </div>
        <div className="ibx-thread__actions">
          <button type="button" className="ibx-iconbtn" aria-label="Filter"><IconFilter size={17} /></button>
          <button type="button" className="ibx-iconbtn" aria-label="Call"><IconPhone size={17} /></button>
          <button type="button" className="ibx-iconbtn" aria-label="Attachments"><IconPaperclip size={17} /></button>
          <button type="button" className="ibx-iconbtn" aria-label="Search thread"><Search size={17} /></button>
          <button type="button" className="ibx-iconbtn" aria-label="More"><MoreVertical size={17} /></button>
        </div>
      </header>

      {ws && (
        <div className="ibx-window" data-state={ws}>
          <IconClock size={16} />
          {ws === "closing" ? (
            <span>The Messenger reply window closes in under 2 hours — reply soon to keep it open.</span>
          ) : (
            <span>
              The 24-hour Messenger window has closed. Replies are blocked until <strong>{c.participant.name}</strong> messages again.
            </span>
          )}
        </div>
      )}

      <ScrollArea className="ibx-scroll">
        <div className="ibx-stream">
          {c.messages.map((m) => {
            const day = dayLabel(m.sentAt);
            const divider = day !== lastDay ? day : null;
            lastDay = day;
            const out = m.direction === "out";
            const who = out ? ME : c.participant;
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {divider && (
                  <div className="ibx-divider">
                    <span>{divider}</span>
                  </div>
                )}
                <div className={`ibx-msg ${out ? "ibx-msg--out" : "ibx-msg--in"}`}>
                  <span className="ibx-msg__avatar">
                    <span className="ibx-avatar" style={{ background: who.accent }}>{who.initials}</span>
                  </span>
                  <div className="ibx-bubble-wrap">
                    <div className="ibx-bubble">{m.body}</div>
                    <div className="ibx-bubble__meta">
                      <span>{clockTime(m.sentAt)}</span>
                      {out && (
                        <span
                          className="ibx-bubble__ticks"
                          style={m.status === "read" ? { color: "#183d2c" } : undefined}
                        >
                          <IconCheckCheck size={14} />
                        </span>
                      )}
                    </div>
                    {m.reactions && m.reactions.length > 0 && (
                      <div className="ibx-reactions">
                        {m.reactions.map((r, i) => (
                          <span key={i} className="ibx-reaction">{r.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <MessageComposer
        disabled={composerDisabled}
        disabledHint="This conversation's 24-hour Messenger window has closed. Replies are blocked until the customer writes again."
        onSend={onSend}
      />
    </section>
  );
}

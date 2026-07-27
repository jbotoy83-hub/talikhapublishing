import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Lightbulb, ImageIcon, Send } from "@/components/icons";
import { IconPaperclip, IconMic, IconSmile } from "./inbox-icons";

interface ComposerProps {
  disabled?: boolean;
  disabledHint?: string;
  onSend: (text: string) => void;
}

export function MessageComposer({ disabled, disabledHint, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const canSend = !disabled && text.trim().length > 0;

  function send() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="ibx-composer" data-disabled={disabled || undefined}>
      <div className="ibx-composer__bar">
        <button type="button" className="ibx-composer__attach" aria-label="Attach" disabled={disabled}>
          <IconPaperclip size={17} />
        </button>
        <div className="ibx-composer__field">
          <textarea
            rows={1}
            placeholder={disabled ? "Replies are blocked" : "Write your message…"}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="ibx-composer__tools">
            <button type="button" className="ibx-tool" aria-label="Formatting" disabled={disabled}>Aa</button>
            <button type="button" className="ibx-tool" aria-label="Assist" disabled={disabled}>
              <Lightbulb size={16} />
            </button>
            <button type="button" className="ibx-tool" aria-label="Image" disabled={disabled}>
              <ImageIcon size={16} />
            </button>
            <button type="button" className="ibx-tool" aria-label="Voice note" disabled={disabled}>
              <IconMic size={16} />
            </button>
            <button type="button" className="ibx-tool" aria-label="Emoji" disabled={disabled}>
              <IconSmile size={16} />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="ibx-composer__send"
          aria-label="Send"
          disabled={!canSend}
          onClick={send}
        >
          <Send size={17} strokeWidth={2} />
        </button>
      </div>
      {disabled && disabledHint && <div className="ibx-composer__hint">{disabledHint}</div>}
    </div>
  );
}

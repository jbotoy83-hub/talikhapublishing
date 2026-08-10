import { useState } from "react";
import { Send } from "@/components/icons";

export function MessageComposer({ disabled, sending, onSend }: { disabled?: boolean; sending?: boolean; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const submit = async () => { const value = body.trim(); if (!value || disabled || sending) return; try { await onSend(value); setBody(""); } catch { return; } };

  return <div className="mail-reply"><label htmlFor="mailReply">Reply as Talikha Publishing</label><div className="mail-reply-box"><textarea id="mailReply" value={body} disabled={disabled || sending} maxLength={20000} onChange={(event) => setBody(event.target.value)} placeholder={disabled ? "Only administrators can send email." : "Write a reply…"} /><footer><span>Sent as branded email with a plain-text copy.</span><button type="button" disabled={!body.trim() || disabled || sending} onClick={() => void submit()}>{sending ? "Sending…" : "Send reply"}<Send size={14} /></button></footer></div></div>;
}

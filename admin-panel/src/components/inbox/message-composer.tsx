import { useState } from "react";
import { Send } from "@/components/icons";

export function MessageComposer({ disabled, sending, onSend }: { disabled?: boolean; sending?: boolean; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const submit = async () => { const value = body.trim(); if (!value || disabled || sending) return; try { await onSend(value); setBody(""); } catch { return; } };
  return <div className="mail-reply"><label htmlFor="mailReply">Reply as Talikha Publishing</label><textarea id="mailReply" value={body} disabled={disabled || sending} maxLength={20000} onChange={(event) => setBody(event.target.value)} placeholder={disabled ? "Only administrators can send email." : "Write a plain-text reply…"} /><div><span>Branded HTML and a plain-text alternative are generated securely.</span><button type="button" disabled={!body.trim() || disabled || sending} onClick={() => void submit()}>{sending ? "Sending…" : "Send reply"}<Send size={15} /></button></div></div>;
}

import { useState } from "react";
import { Send } from "@/components/icons";
import { RichEmailEditor, type RichEmailValue } from "./rich-email-editor";

export function MessageComposer({ disabled, sending, onSend }: { disabled?: boolean; sending?: boolean; onSend: (value: RichEmailValue) => Promise<void> }) {
  const [value, setValue] = useState<RichEmailValue>({ text: "", html: "" });
  const [editorKey, setEditorKey] = useState(0);
  const submit = async () => { if (!value.text || disabled || sending) return; try { await onSend(value); setValue({ text: "", html: "" }); setEditorKey((current) => current + 1); } catch { return; } };

  return <div className="mail-reply"><label>Reply as Talikha Publishing</label><div className="mail-reply-box"><RichEmailEditor key={editorKey} disabled={disabled || sending} placeholder={disabled ? "Only administrators can send email." : "Write a reply…"} minHeight={70} onChange={setValue} /><footer><span>Formatting and images are preserved in Gmail, with a plain-text copy included.</span><button type="button" disabled={!value.text || disabled || sending} onClick={() => void submit()}>{sending ? "Sending…" : "Send reply"}<Send size={14} /></button></footer></div></div>;
}

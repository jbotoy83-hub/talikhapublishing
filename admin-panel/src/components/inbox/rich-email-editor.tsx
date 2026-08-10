import { useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Image, Italic, Link, List, ListOrdered, RemoveFormatting, Underline } from "lucide-react";

export type RichEmailValue = { text: string; html: string };

export function RichEmailEditor({ disabled, placeholder, minHeight = 96, onChange }: { disabled?: boolean; placeholder: string; minHeight?: number; onChange: (value: RichEmailValue) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange({ text: (editor.innerText || "").replace(/\u00a0/g, " ").trim(), html: editor.innerHTML.trim() });
  };

  const command = (name: string, value?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("Paste an HTTPS link");
    if (!url) return;
    if (!/^https:\/\//i.test(url.trim())) { setError("Links must begin with https://"); return; }
    setError("");
    command("createLink", url.trim());
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/admin/inbox/images", { method: "POST", body: form, credentials: "same-origin" });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "The image could not be uploaded.");
      command("insertImage", payload.url);
      editorRef.current?.querySelectorAll("img").forEach((image) => { image.style.maxWidth = "100%"; image.style.height = "auto"; });
      emit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const tools = [
    { title: "Bold", icon: Bold, action: () => command("bold") },
    { title: "Italic", icon: Italic, action: () => command("italic") },
    { title: "Underline", icon: Underline, action: () => command("underline") },
    { title: "Bulleted list", icon: List, action: () => command("insertUnorderedList") },
    { title: "Numbered list", icon: ListOrdered, action: () => command("insertOrderedList") },
    { title: "Align left", icon: AlignLeft, action: () => command("justifyLeft") },
    { title: "Align center", icon: AlignCenter, action: () => command("justifyCenter") },
    { title: "Align right", icon: AlignRight, action: () => command("justifyRight") },
    { title: "Add link", icon: Link, action: addLink },
    { title: "Add image", icon: Image, action: () => imageInputRef.current?.click() },
    { title: "Clear formatting", icon: RemoveFormatting, action: () => command("removeFormat") }
  ];

  return <div className="mail-rich-editor" data-disabled={disabled || uploading}>
    <div className="mail-format-toolbar" role="toolbar" aria-label="Message formatting">{tools.map((tool) => <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} disabled={disabled || uploading} onMouseDown={(event) => event.preventDefault()} onClick={tool.action}><tool.icon size={15} /></button>)}</div>
    <div ref={editorRef} className="mail-editable" contentEditable={!disabled && !uploading} data-placeholder={uploading ? "Uploading image…" : placeholder} style={{ minHeight }} role="textbox" aria-multiline="true" suppressContentEditableWarning onInput={emit} />
    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void uploadImage(event.target.files?.[0])} />
    {error && <p className="mail-editor-error">{error}</p>}
  </div>;
}

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  AtSign,
  BriefcaseBusiness,
  Camera,
  ChevronDown,
  ExternalLink,
  Globe2,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import "./account-profile.css";

export type StaffProfile = {
  displayName: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  username: string;
  headline: string;
  bio: string;
  location: string;
  website: string;
  pronouns: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt?: string;
  lastSignedInAt?: string | null;
};

type Props = {
  profile: StaffProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileChange: (profile: StaffProfile) => void;
  onOpenSettings: () => void;
};

const roleLabel = (role: StaffProfile["role"]) => role === "admin" ? "Administrator" : role === "editor" ? "Editor" : "Viewer";
const initials = (name: string, email: string) => (name || email.split("@")[0] || "T")
  .split(/[\s._-]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("");
const usernameFallback = (profile: StaffProfile) => profile.username || profile.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);

function ProfileAvatar({ profile, className = "" }: { profile: StaffProfile; className?: string }) {
  return (
    <span className={`staff-avatar ${className}`} aria-hidden="true">
      <span>{initials(profile.displayName, profile.email)}</span>
      {profile.avatarUrl && <i className="staff-avatar__image" style={{ backgroundImage: `url(${JSON.stringify(profile.avatarUrl)})` }} />}
    </span>
  );
}

function ProfileEditor({ profile, onClose, onProfileChange }: { profile: StaffProfile; onClose: () => void; onProfileChange: (profile: StaffProfile) => void }) {
  const [form, setForm] = useState(() => ({ ...profile, username: usernameFallback(profile) }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !uploading) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving, uploading]);

  const update = (field: keyof StaffProfile, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function uploadImage(kind: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(kind);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("kind", kind);
      const response = await fetch("/api/admin/profile/images", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The image could not be uploaded.");
      const next = { ...form, [kind === "avatar" ? "avatarUrl" : "coverUrl"]: String(result.url || "") };
      setForm(next);
      onProfileChange(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setUploading(null);
    }
  }

  async function removeImage(kind: "avatar" | "cover") {
    setUploading(kind);
    setError("");
    try {
      const response = await fetch(`/api/admin/profile/images?kind=${kind}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The image could not be removed.");
      const next = { ...form, [kind === "avatar" ? "avatarUrl" : "coverUrl"]: null };
      setForm(next);
      onProfileChange(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be removed.");
    } finally {
      setUploading(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          username: form.username,
          headline: form.headline,
          bio: form.bio,
          location: form.location,
          website: form.website,
          pronouns: form.pronouns,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Your profile could not be saved.");
      const next = { ...form, ...result.profile } as StaffProfile;
      setForm(next);
      onProfileChange(next);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-editor-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
        <header className="profile-editor__topbar">
          <button type="button" className="profile-icon-button" onClick={onClose} aria-label="Close profile editor"><X size={19} /></button>
          <div><span>Account profile</span><strong id="profile-editor-title">Edit profile</strong></div>
          <button type="submit" form="staff-profile-form" className="profile-save" disabled={saving || Boolean(uploading)}>
            {saving && <LoaderCircle size={14} className="profile-spin" />}{saving ? "Saving" : "Save changes"}
          </button>
        </header>

        <form id="staff-profile-form" onSubmit={save}>
          <div className="profile-editor__visuals">
            <div className="profile-cover" style={form.coverUrl ? { backgroundImage: `url(${form.coverUrl})` } : undefined}>
              <div className="profile-cover__wash" />
              <div className="profile-image-actions">
                <button type="button" onClick={() => coverInput.current?.click()} aria-label="Upload cover image" disabled={Boolean(uploading)}>
                  {uploading === "cover" ? <LoaderCircle size={18} className="profile-spin" /> : <Camera size={18} />}
                </button>
                {form.coverUrl && <button type="button" onClick={() => removeImage("cover")} aria-label="Remove cover image" disabled={Boolean(uploading)}><Trash2 size={17} /></button>}
              </div>
              <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => uploadImage("cover", event)} />
            </div>
            <div className="profile-editor__avatar-wrap">
              <ProfileAvatar profile={form} className="staff-avatar--editor" />
              <button type="button" className="profile-avatar-edit" onClick={() => avatarInput.current?.click()} aria-label="Upload profile photo" disabled={Boolean(uploading)}>
                {uploading === "avatar" ? <LoaderCircle size={18} className="profile-spin" /> : <Camera size={18} />}
              </button>
              {form.avatarUrl && <button type="button" className="profile-avatar-remove" onClick={() => removeImage("avatar")} aria-label="Remove profile photo" disabled={Boolean(uploading)}><X size={14} /></button>}
              <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => uploadImage("avatar", event)} />
            </div>
            <p>JPG, PNG, or WebP · 5 MB maximum</p>
          </div>

          <div className="profile-editor__body">
            {error && <div className="profile-form-message profile-form-message--error" role="alert">{error}</div>}
            {saved && <div className="profile-form-message profile-form-message--saved" role="status">Profile updated. Your Overview greeting is now current.</div>}
            <div className="profile-field-grid">
              <label className="profile-field"><span>Name <b>{form.displayName.length}/80</b></span><input value={form.displayName} maxLength={80} required onChange={(event) => update("displayName", event.target.value)} /></label>
              <label className="profile-field"><span>Username <b>{form.username.length}/32</b></span><div className="profile-input-with-icon"><AtSign size={15} /><input value={form.username} maxLength={32} required autoCapitalize="none" spellCheck={false} onChange={(event) => update("username", event.target.value.toLowerCase().replace(/\s/g, ""))} /></div></label>
            </div>
            <div className="profile-field-grid">
              <label className="profile-field"><span>Professional title <b>{form.headline.length}/80</b></span><div className="profile-input-with-icon"><BriefcaseBusiness size={15} /><input value={form.headline} maxLength={80} placeholder="Managing editor" onChange={(event) => update("headline", event.target.value)} /></div></label>
              <label className="profile-field"><span>Pronouns <b>{form.pronouns.length}/30</b></span><input value={form.pronouns} maxLength={30} placeholder="Optional" onChange={(event) => update("pronouns", event.target.value)} /></label>
            </div>
            <label className="profile-field profile-field--bio"><span>Bio <b>{form.bio.length}/300</b></span><textarea value={form.bio} maxLength={300} rows={4} placeholder="Share your role, editorial interests, or area of expertise." onChange={(event) => update("bio", event.target.value)} /></label>
            <div className="profile-field-grid">
              <label className="profile-field"><span>Location</span><div className="profile-input-with-icon"><MapPin size={15} /><input value={form.location} maxLength={80} placeholder="City, country" onChange={(event) => update("location", event.target.value)} /></div></label>
              <label className="profile-field"><span>Website</span><div className="profile-input-with-icon"><Globe2 size={15} /><input type="url" value={form.website} maxLength={160} placeholder="https://" onChange={(event) => update("website", event.target.value)} /></div></label>
            </div>
            <div className="profile-readonly">
              <div><Mail size={15} /><span><small>Sign-in email</small>{form.email}</span></div>
              <div><ShieldCheck size={15} /><span><small>Workspace role</small>{roleLabel(form.role)}</span></div>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export function AccountProfile({ profile, open, onOpenChange, onProfileChange, onOpenSettings }: Props) {
  const [editing, setEditing] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const joined = useMemo(() => profile.createdAt ? new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(new Date(profile.createdAt)) : "", [profile.createdAt]);
  const handle = usernameFallback(profile);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, onOpenChange]);

  return (
    <div className="tp-account" ref={container}>
      <button type="button" className="tp-profile" onClick={() => onOpenChange(!open)} aria-label="Open account profile" aria-expanded={open}>
        <ProfileAvatar profile={profile} className="staff-avatar--trigger" />
        <ChevronDown size={13} strokeWidth={1.8} />
      </button>
      {open && (
        <aside className="account-card" aria-label="Account profile">
          <div className="account-card__cover" style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined} />
          <div className="account-card__identity">
            <ProfileAvatar profile={profile} className="staff-avatar--card" />
            <button type="button" className="account-card__edit" onClick={() => { setEditing(true); onOpenChange(false); }}><Pencil size={14} />Edit profile</button>
          </div>
          <div className="account-card__details">
            <div className="account-card__name"><strong>{profile.displayName || "Your profile"}</strong><span>{roleLabel(profile.role)}</span></div>
            <p className="account-card__handle">@{handle}</p>
            {profile.headline && <p className="account-card__headline">{profile.headline}</p>}
            {profile.bio && <p className="account-card__bio">{profile.bio}</p>}
            <div className="account-card__metadata">
              <span><Mail size={13} />{profile.email}</span>
              {profile.location && <span><MapPin size={13} />{profile.location}</span>}
              {joined && <span>Joined {joined}</span>}
              {profile.website && <a href={profile.website} target="_blank" rel="noreferrer"><ExternalLink size={13} />Website</a>}
            </div>
          </div>
          <nav className="account-card__actions">
            <button type="button" onClick={onOpenSettings}><Settings size={16} />Workspace settings</button>
            <button type="button" disabled><ShieldCheck size={16} />Account security <small>Managed</small></button>
            <form action="/api/admin/logout" method="post"><button type="submit"><LogOut size={16} />Sign out</button></form>
          </nav>
        </aside>
      )}
      {editing && createPortal(<ProfileEditor key={profile.email || "loading"} profile={profile} onClose={() => setEditing(false)} onProfileChange={onProfileChange} />, document.body)}
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Cropper from "react-easy-crop";
import { Icon } from "./icon";
import { CheckIcon } from "@/components/icons/check";
import { CircleChevronLeftIcon } from "@/components/icons/circle-chevron-left";
import { LoaderCircleIcon } from "@/components/icons/loader-circle";
import { MinusIcon } from "@/components/icons/minus";
import { MoveDiagonalIcon } from "@/components/icons/move-diagonal";
import { PlusIcon } from "@/components/icons/plus";
import { ScanIcon } from "@/components/icons/scan";
import { Trash2Icon } from "@/components/icons/trash-2";
import { XIcon } from "@/components/icons/x";

const OUTPUT = 1024;
const PREVIEW = 128;

type Area = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };
export type PhotoBg = "white" | "none";

const CROP_SIZE = /(?:^|\s)(?:size|h|w)-(\d+(?:\.\d+)?)(?=\s|$)/;
function cropSize(className: string): number | undefined {
  const match = className.match(CROP_SIZE);
  return match ? Math.round(parseFloat(match[1]) * 4) : undefined;
}

function CameraGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return <ScanIcon className={className} size={cropSize(className)} strokeWidth={1.8} aria-hidden />;
}
function CheckGlyph({ className = "h-3 w-3" }: { className?: string }) {
  return <CheckIcon className={className} size={cropSize(className)} strokeWidth={3} aria-hidden />;
}
function TrashGlyph({ className = "h-3 w-3" }: { className?: string }) {
  return <Trash2Icon className={className} size={cropSize(className)} strokeWidth={1.8} aria-hidden />;
}
function RotateGlyph() {
  return <LoaderCircleIcon size={16} strokeWidth={1.8} aria-hidden />;
}
function MinusGlyph() {
  return <MinusIcon size={15} strokeWidth={2.2} aria-hidden />;
}
function PlusGlyph() {
  return <PlusIcon size={15} strokeWidth={2.2} aria-hidden />;
}
function CloseGlyph() {
  return <XIcon size={16} strokeWidth={2} aria-hidden />;
}
function MoveGlyph() {
  return <MoveDiagonalIcon size={15} strokeWidth={1.8} aria-hidden />;
}
function ResetGlyph() {
  return <CircleChevronLeftIcon size={15} strokeWidth={1.8} aria-hidden />;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Image could not be loaded")));
    img.src = url;
  });
}

function rad(deg: number) { return (deg * Math.PI) / 180; }

function rotatedSize(w: number, h: number, r: number) {
  const a = rad(r);
  return { width: Math.abs(Math.cos(a) * w) + Math.abs(Math.sin(a) * h), height: Math.abs(Math.sin(a) * w) + Math.abs(Math.cos(a) * h) };
}

async function makeCropped(imageSrc: string, pixelCrop: Area, rotation: number, out: number, bg: PhotoBg): Promise<string | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rs = rotatedSize(image.width, image.height, rotation);
  const maxDim = Math.max(image.width, image.height);
  const safe = 2 * ((maxDim / 2) * Math.sqrt(2));
  canvas.width = safe;
  canvas.height = safe;
  ctx.translate(safe / 2, safe / 2);
  ctx.rotate(rad(rotation));
  ctx.translate(-safe / 2, -safe / 2);
  ctx.drawImage(image, safe / 2 - image.width * 0.5, safe / 2 - image.height * 0.5);
  const data = ctx.getImageData(0, 0, safe, safe);
  canvas.width = rs.width;
  canvas.height = rs.height;
  ctx.putImageData(data, Math.round(0 - safe / 2 + rs.width * 0.5), Math.round(0 - safe / 2 + rs.height * 0.5));
  const final = document.createElement("canvas");
  final.width = out;
  final.height = out;
  const fctx = final.getContext("2d");
  if (!fctx) return null;
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  if (bg === "white") {
    fctx.fillStyle = "#ffffff";
    fctx.fillRect(0, 0, out, out);
  }
  fctx.drawImage(canvas, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, out, out);
  return bg === "white" ? final.toDataURL("image/jpeg", 0.92) : final.toDataURL("image/png");
}

export function authorInitials(p: { firstName?: string; familyName?: string }) {
  const a = (p.firstName || "").trim();
  const b = (p.familyName || "").trim();
  return [a, b].filter(Boolean).map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

type SlotSize = "lg" | "md" | "sm" | "xs";

type PhotoSlotProps = {
  photo: string;
  initials: string;
  size: SlotSize;
  onPick?: () => void;
  onRemove?: () => void;
  verified?: boolean;
  order?: number;
  label: string;
  interactive?: boolean;
};

export function PhotoSlot({ photo, initials, size, onPick, onRemove, verified, order, label, interactive = true }: PhotoSlotProps) {
  const inner = photo
    ? <img src={photo} alt="" draggable={false} />
    : <span className="aphoto-init">{initials || <CameraGlyph className="h-5 w-5" />}</span>;
  const veil = interactive ? <span className="aphoto-veil" aria-hidden="true"><CameraGlyph className="h-5 w-5" /></span> : null;
  const circle = interactive
    ? <button type="button" className="aphoto-circle" onClick={() => onPick?.()} aria-label={label}>{inner}{veil}</button>
    : <span className="aphoto-circle" aria-hidden="true">{inner}</span>;
  return (
    <span className={`aphoto aphoto-${size}`}>
      {circle}
      {order != null && <span className="aphoto-order" aria-hidden="true">{order}</span>}
      {verified && <span className="aphoto-verified" aria-hidden="true"><CheckGlyph /></span>}
      {interactive && onRemove && photo && (
        <button type="button" className="aphoto-x" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove photo"><TrashGlyph /></button>
      )}
    </span>
  );
}

type CropperProps = {
  src: string;
  title?: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

export function AuthorPhotoCropper({ src, title, onCancel, onConfirm }: CropperProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [spin, setSpin] = useState(0);
  const [minZoom, setMinZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [bg, setBg] = useState<PhotoBg>("white");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [replaceError, setReplaceError] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const naturalRef = useRef<Size | null>(null);
  const cropSizeRef = useRef<Size | null>(null);
  const rotationRef = useRef(0);
  const refitRef = useRef(true);
  const internalBlobRef = useRef<string | null>(null);
const imageSrcRef = useRef(src);
  useEffect(() => () => { if (internalBlobRef.current) URL.revokeObjectURL(internalBlobRef.current); }, []);

  const maxZoom = minZoom * 4;
  const pct = Math.round((zoom / minZoom) * 100);
  const fill = Math.max(0, Math.min(100, ((zoom - minZoom) / (maxZoom - minZoom)) * 100));
  const step = Math.max(0.04, (maxZoom - minZoom) / 22);

  const recompute = useCallback(() => {
    const nat = naturalRef.current;
    const cs = cropSizeRef.current;
    const stage = stageRef.current;
    if (!nat || !cs || !stage) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H || !cs.width) return;
    const swap = (rotationRef.current / 90) % 2 === 1;
    const nw = swap ? nat.height : nat.width;
    const nh = swap ? nat.width : nat.height;
    const base = Math.min(W / nw, H / nh);
    const c = Math.min(cs.width, cs.height);
    const raw = c / (base * Math.min(nw, nh));
    const mz = Math.max(1, raw);
    setMinZoom(mz);
    if (refitRef.current) { setZoom(mz); refitRef.current = false; }
    else setZoom((z) => (z < mz ? mz : z));
  }, []);

  useEffect(() => { rotationRef.current = rotation; recompute(); }, [rotation, recompute]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    if (!area) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const url = await makeCropped(imageSrc, area, rotation, PREVIEW, bg);
      if (!cancelled && url) setPreview(url);
    }, 90);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [area, rotation, imageSrc, bg]);

  async function confirm() {
    if (!area || busy) return;
    setBusy(true);
    try {
      const out = await makeCropped(imageSrc, area, rotation, OUTPUT, bg);
      if (out) onConfirm(out);
    } finally {
      setBusy(false);
    }
  }

  function replaceSource() {
    setReplaceError("");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (!f.type.startsWith("image/")) { setReplaceError("Please choose an image file (PNG, JPG, or WebP)."); return; }
      if (f.size > 12 * 1024 * 1024) { setReplaceError("That image is too large — please use one under 12 MB."); return; }
      const url = URL.createObjectURL(f);
      if (imageSrcRef.current.startsWith("blob:")) URL.revokeObjectURL(imageSrcRef.current);
      imageSrcRef.current = url;
      setImageSrc(url);
      naturalRef.current = null;
      cropSizeRef.current = null;
      refitRef.current = true;
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setSpin(0);
      setArea(null);
      setPreview(null);
      setTouched(false);
    };
    input.click();
  }

  function rotate() { setRotation((r) => (r + 90) % 360); setSpin((s) => s + 90); }
  function reset() { refitRef.current = true; setCrop({ x: 0, y: 0 }); setRotation(0); setSpin(0); }

  return (
    <motion.div
      className="acrop-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Crop profile photo"
    >
      <motion.div
        ref={cardRef}
        className="acrop-modal"
        tabIndex={-1}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: "tween", duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="acrop-head">
          <div>
            <p className="acrop-eyebrow">Profile photo</p>
            <h3>{title || "Crop your photo"}</h3>
          </div>
          <div className="acrop-head-actions">
            <button type="button" className="acrop-replace" onClick={replaceSource} aria-label="Upload a different photo"><CameraGlyph className="h-4 w-4" /> Replace</button>
            <button type="button" className="acrop-close" onClick={onCancel} aria-label="Cancel and discard photo"><CloseGlyph /></button>
          </div>
        </div>

        <div className="acrop-stage" ref={stageRef}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            objectFit="contain"
            minZoom={minZoom}
            maxZoom={maxZoom}
            zoomWithScroll
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={(z) => { setZoom(z); setTouched(true); }}
            onRotationChange={setRotation}
            onCropComplete={(_a, p) => setArea(p)}
            onMediaLoaded={(m) => { naturalRef.current = { width: m.naturalWidth, height: m.naturalHeight }; recompute(); }}
            onCropSizeChange={(s) => { cropSizeRef.current = s; recompute(); }}
            onInteractionStart={() => setTouched(true)}
            classes={{ mediaClassName: bg === "none" ? "acrop-media-check" : "acrop-media-white" }}
            style={{ cropAreaStyle: { boxShadow: "0 0 0 2px rgba(150,215,170,.95), 0 0 0 9999px rgba(8,24,18,.82)" } }}
          />
          <AnimatePresence>
            {!touched && (
              <motion.div className="acrop-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <MoveGlyph /> Drag to position · scroll or slide to zoom
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="acrop-controls">
          <div className="acrop-zoom">
            <button type="button" className="acrop-zbtn" onClick={() => { setZoom((z) => Math.max(minZoom, +(z - step).toFixed(3))); setTouched(true); }} aria-label="Zoom out"><MinusGlyph /></button>
            <input
              className="acrop-range"
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.005}
              value={zoom}
              onChange={(e) => { setZoom(parseFloat(e.target.value)); setTouched(true); }}
              style={{ ["--fill" as string]: `${fill}%` } as React.CSSProperties}
              aria-label="Zoom level"
              aria-valuetext={`${pct} percent`}
            />
            <button type="button" className="acrop-zbtn" onClick={() => { setZoom((z) => Math.min(maxZoom, +(z + step).toFixed(3))); setTouched(true); }} aria-label="Zoom in"><PlusGlyph /></button>
            <span className="acrop-pct">{pct}%</span>
          </div>
          <button type="button" className="acrop-rotate" onClick={rotate} aria-label="Rotate photo 90 degrees">
            <span className="acrop-rotate-ico" style={{ transform: `rotate(${spin}deg)` }}><RotateGlyph /></span> Rotate
          </button>
          <button type="button" className="acrop-rotate" onClick={reset} aria-label="Reset position and zoom">
            <ResetGlyph /> Reset
          </button>
          <div className="acrop-bgseg" role="group" aria-label="Background">
            <span className="acrop-bgseg-label">Background</span>
            <button type="button" className={bg === "white" ? "on" : ""} onClick={() => setBg("white")} aria-pressed={bg === "white"}><span className="acrop-bgseg-sw white" /> White</button>
            <button type="button" className={bg === "none" ? "on" : ""} onClick={() => setBg("none")} aria-pressed={bg === "none"}><span className="acrop-bgseg-sw check" /> None</button>
          </div>
        </div>

        {replaceError && <p className="acrop-err" role="alert">{replaceError}</p>}

        <div className="acrop-foot">
          <div className="acrop-result">
            <span className={`acrop-result-thumb ${bg === "none" ? "acrop-checker" : ""}`}>{preview ? <img src={preview} alt="" /> : <span className="acrop-result-ph" />}</span>
            <div className="acrop-result-copy">
              <strong>{OUTPUT} × {OUTPUT}</strong>
              <span>{bg === "none" ? "Saved as PNG · transparent background" : "Saved as JPEG · white background"}</span>
            </div>
          </div>
          <div className="acrop-foot-right">
            <button type="button" className="submission-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="submission-primary" onClick={confirm} disabled={busy}>
              {busy ? <><span className="acrop-spin" />Cropping…</> : <>Use this photo <Icon name="check" className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

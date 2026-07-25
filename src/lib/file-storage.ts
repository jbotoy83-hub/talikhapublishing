export type FileStatus = "queued" | "uploading" | "processing" | "validating" | "completed" | "error" | "cancelled";

export type FilePurpose = "manuscript" | "supporting" | "cover-image" | "payment-proof";

export type StoredFile = {
  id: string;
  name: string;
  originalName: string;
  sanitized: boolean;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploader: string;
  purpose: FilePurpose;
  required: boolean;
  category: string;
  notes: string;
  status: FileStatus;
  progress: number;
  uploadedBytes: number;
  version: number;
  replacedBy: string | null;
  error: string | null;
};

export type FileValidationResult = {
  valid: boolean;
  errors: string[];
};

const DB_NAME = "talikha-file-storage";
const DB_VERSION = 1;
const BLOB_STORE = "blobs";
const META_STORE = "meta";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const req = tx.objectStore(BLOB_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMeta(file: StoredFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put(file);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta(id: string): Promise<StoredFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMeta(): Promise<StoredFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMeta(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFile(id: string): Promise<void> {
  await Promise.all([deleteBlob(id), deleteMeta(id)]);
}

export function sanitizeFilename(name: string): { sanitized: string; wasSanitized: boolean } {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s{2,}/g, " ").trim();
  return { sanitized: cleaned || "untitled", wasSanitized: cleaned !== name };
}

const DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".vbs", ".js", ".wsf", ".ps1", ".sh", ".dll", ".ocx", ".sys"];

export function validateFile(
  file: File,
  purpose: FilePurpose,
  existingFiles: StoredFile[],
  maxSizeMB: number
): FileValidationResult {
  const errors: string[] = [];
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    errors.push("This file type is not allowed for security reasons.");
    return { valid: false, errors };
  }

  const allowedByPurpose: Record<FilePurpose, string[]> = {
    manuscript: [".docx", ".pdf"],
    supporting: [".docx", ".doc", ".odt", ".rtf", ".pdf", ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".zip"],
    "cover-image": [".jpg", ".jpeg", ".png", ".tif", ".tiff"],
    "payment-proof": [".jpg", ".jpeg", ".png", ".pdf", ".gif"]
  };

  const allowed = allowedByPurpose[purpose];
  if (!allowed.includes(ext)) {
    errors.push(`Unsupported format for ${purpose}. Accepted: ${allowed.join(", ")}`);
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    errors.push(`File exceeds ${maxSizeMB}MB limit.`);
  }

  if (file.size === 0) {
    errors.push("File is empty.");
  }

  const duplicate = existingFiles.find(
    (f) => f.name === file.name && f.size === file.size && f.purpose === purpose && f.status !== "cancelled"
  );
  if (duplicate) {
    errors.push("A file with this name and size already exists.");
  }

  return { valid: errors.length === 0, errors };
}

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toUpperCase() : "";
}

export function getFileTypeLabel(mimeType: string, name: string): string {
  const ext = getFileExtension(name);
  if (mimeType.startsWith("image/")) return `Image (.${ext.toLowerCase()})`;
  if (mimeType === "application/pdf") return "PDF";
  if (ext === "DOCX" || ext === "DOC") return "Word Document";
  if (ext === "XLSX" || ext === "XLS") return "Spreadsheet";
  if (ext === "CSV") return "CSV";
  if (ext === "ZIP") return "Archive";
  return ext || mimeType;
}

export function isDocx(file: StoredFile): boolean {
  return file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx");
}

export function isPdf(file: StoredFile): boolean {
  return file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isImage(file: StoredFile): boolean {
  return file.mimeType.startsWith("image/");
}

export function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatProgress(uploaded: number, total: number): string {
  return `${formatBytes(uploaded)} / ${formatBytes(total)}`;
}

export const PURPOSE_LABELS: Record<FilePurpose, string> = {
  manuscript: "Main Manuscript",
  supporting: "Supporting File",
  "cover-image": "Cover Image",
  "payment-proof": "Payment Proof"
};

export const PURPOSE_MAX_SIZE: Record<FilePurpose, number> = {
  manuscript: 15,
  supporting: 100,
  "cover-image": 10,
  "payment-proof": 5
};

export const PURPOSE_ACCEPT: Record<FilePurpose, string> = {
  manuscript: ".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",
  supporting: ".docx,.doc,.odt,.rtf,.pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.tif,.tiff,.zip",
  "cover-image": ".jpg,.jpeg,.png,.tif,.tiff,image/jpeg,image/png,image/tiff",
  "payment-proof": ".jpg,.jpeg,.png,.pdf,.gif,image/jpeg,image/png,image/gif,application/pdf"
};

export const CATEGORIES = ["Research Article", "Essay", "Poetry", "Fiction", "Book Chapter", "Literary Review", "Commentary", "Data Set", "Appendix", "Supplementary Material", "Cover Letter", "Copyright Form", "Other"];

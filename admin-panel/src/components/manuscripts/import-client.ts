import type { ImportWorkerResponse, ManuscriptImportPayload } from "./types";

export function importManuscriptOffThread(file: Blob, fileName: string, mimeType: string, onProgress?: (message: string) => void) {
  return new Promise<ManuscriptImportPayload>(async (resolve, reject) => {
    onProgress?.("Reading the private source file…");
    const bytes = await file.arrayBuffer();
    const worker = new Worker(new URL("./manuscript-import.worker.ts", import.meta.url), { type: "module", name: "talikha-manuscript-import" });
    const cleanup = () => worker.terminate();
    worker.onerror = (event) => { cleanup(); reject(new Error(event.message || "The import worker stopped unexpectedly.")); };
    worker.onmessage = (event: MessageEvent<ImportWorkerResponse>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.payload);
      else reject(Object.assign(new Error(event.data.message), { code: event.data.code }));
    };
    onProgress?.(mimeType === "application/pdf" || /\.pdf$/i.test(fileName) ? "Reconstructing PDF reading order…" : "Reconstructing Word paragraphs and formatting…");
    worker.postMessage({ bytes, fileName, mimeType }, [bytes]);
  });
}

export async function fetchPrivateSource(fileId: string) {
  const response = await fetch(`/api/admin/files/${fileId}?stream=1`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("The original manuscript could not be loaded from private storage.");
  return response.blob();
}

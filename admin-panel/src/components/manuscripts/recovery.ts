import type { LinkedFieldBinding, ManuscriptEditorState, ManuscriptManualConfirmations, ManuscriptPageSettings } from "./types";

export type ManuscriptRecovery = {
  documentId: string;
  baseRevision: number;
  editorState: ManuscriptEditorState;
  pageSettings: ManuscriptPageSettings;
  fieldBindings: LinkedFieldBinding[];
  manualConfirmations: ManuscriptManualConfirmations;
  contentText: string;
  savedAt: string;
};

const DATABASE = "talikha-manuscript-recovery";
const STORE = "unsent-drafts";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "documentId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export const manuscriptRecovery = {
  read: (documentId: string) => transact<ManuscriptRecovery | undefined>("readonly", (store) => store.get(documentId)),
  write: (draft: ManuscriptRecovery) => transact<IDBValidKey>("readwrite", (store) => store.put(draft)),
  clear: (documentId: string) => transact<undefined>("readwrite", (store) => store.delete(documentId)),
};

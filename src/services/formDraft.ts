export interface ServiceFormDraft<TFormData, TExtra extends Record<string, unknown> = Record<string, unknown>> {
  formData: TFormData;
  currentStep: number;
  updatedAt: string;
  extra?: TExtra;
}

export const loadServiceFormDraft = <TFormData, TExtra extends Record<string, unknown> = Record<string, unknown>>(
  key: string
): ServiceFormDraft<TFormData, TExtra> | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export const saveServiceFormDraft = <TFormData, TExtra extends Record<string, unknown> = Record<string, unknown>>(
  key: string,
  draft: Omit<ServiceFormDraft<TFormData, TExtra>, 'updatedAt'>
) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch (_) {
    // localStorage can fail in private browsing or when quota is full. Drafting is best-effort.
  }
};

export const clearServiceFormDraft = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (_) {
    // best-effort cleanup
  }
};

export const clampDraftStep = (step: unknown, minStep = 1, maxStep = 3) => {
  const parsed = typeof step === 'number' ? step : Number(step);
  if (!Number.isFinite(parsed)) return minStep;
  return Math.min(Math.max(parsed, minStep), maxStep);
};

export const mergeDraftData = <T extends Record<string, any> = Record<string, any>>(initial: T, draft?: Partial<T>): T => ({
  ...initial,
  ...(draft || {}),
} as T);

// ============================================================================
// INDEXEDDB FILE PERSISTENCE
// ============================================================================

const DB_NAME = 'RegiBIZFormDB';
const STORE_NAME = 'files';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB database for file storage
 */
export const initFileDB = (): Promise<IDBDatabase> => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Save a file to IndexedDB for draft persistence
 * @param draftKey - The form draft key (e.g., 'adt1_form_draft_v1')
 * @param fileKey - The field name (e.g., 'boardResolution', 'balanceSheet')
 * @param file - The File object to store
 */
export const saveFileToDraft = async (draftKey: string, fileKey: string, file: File): Promise<void> => {
  try {
    const db = await initFileDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const key = `${draftKey}_${fileKey}`;
    
    return new Promise((resolve, reject) => {
      const request = store.put(file, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`Could not save file to draft (${draftKey}/${fileKey}):`, error);
    // Best-effort: continue without draft file persistence
  }
};

/**
 * Retrieve a file from IndexedDB draft
 * @param draftKey - The form draft key
 * @param fileKey - The field name
 * @returns The File object if found, null otherwise
 */
export const getFileFromDraft = async (draftKey: string, fileKey: string): Promise<File | null> => {
  try {
    const db = await initFileDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const key = `${draftKey}_${fileKey}`;
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`Could not retrieve file from draft (${draftKey}/${fileKey}):`, error);
    return null;
  }
};

/**
 * Delete a specific file from IndexedDB draft
 * @param draftKey - The form draft key
 * @param fileKey - The field name
 */
export const deleteFileFromDraft = async (draftKey: string, fileKey: string): Promise<void> => {
  try {
    const db = await initFileDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const key = `${draftKey}_${fileKey}`;
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`Could not delete file from draft (${draftKey}/${fileKey}):`, error);
  }
};

/**
 * Clear all files for a draft (when form is successfully submitted)
 * @param draftKey - The form draft key
 * @param fileKeys - Array of field names to clear (e.g., ['boardResolution', 'auditorConsent'])
 */
export const clearAllFilesFromDraft = async (draftKey: string, fileKeys: string[]): Promise<void> => {
  try {
    await Promise.all(fileKeys.map(key => deleteFileFromDraft(draftKey, key)));
  } catch (error) {
    console.warn(`Could not clear files from draft (${draftKey}):`, error);
  }
};

/**
 * Restore all files for a draft from IndexedDB
 * @param draftKey - The form draft key
 * @param fileKeys - Array of field names to restore
 * @returns Record mapping fileKey to File | null
 */
export const restoreFilesFromDraft = async (
  draftKey: string,
  fileKeys: string[]
): Promise<Record<string, File | null>> => {
  try {
    const restoredFiles: Record<string, File | null> = {};
    
    for (const key of fileKeys) {
      const file = await getFileFromDraft(draftKey, key);
      restoredFiles[key] = file || null;
    }
    
    return restoredFiles;
  } catch (error) {
    console.warn(`Could not restore files from draft (${draftKey}):`, error);
    return {};
  }
};

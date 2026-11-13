import { StatisticSession } from '../types';

const DB_NAME = 'EduStatProDB';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_FILES = 'files';

interface StoredFile {
  sessionId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  dataBase64?: string; // Optional raw base64 or array buffer
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lưu một phiên thống kê vào IndexedDB
 */
export async function saveSession(session: StatisticSession, fileBase64?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SESSIONS, STORE_FILES], 'readwrite');
    const sessionStore = tx.objectStore(STORE_SESSIONS);
    const fileStore = tx.objectStore(STORE_FILES);

    sessionStore.put(session);

    if (fileBase64) {
      const fileRecord: StoredFile = {
        sessionId: session.id,
        fileName: session.fileName,
        fileSize: session.fileSize,
        uploadedAt: session.createdAt,
        dataBase64: fileBase64,
      };
      fileStore.put(fileRecord);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Lấy tất cả các phiên thống kê đã lưu, sắp xếp theo thời gian mới nhất trước
 */
export async function getAllSessions(): Promise<StatisticSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as StatisticSession[]) || [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lấy chi tiết một phiên thống kê
 */
export async function getSessionById(id: string): Promise<StatisticSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as StatisticSession) || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cập nhật thông tin phiên (ví dụ: đổi tên, cập nhật tên giáo viên)
 */
export async function updateSession(session: StatisticSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    store.put(session);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Xóa một phiên thống kê và file gốc đính kèm
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SESSIONS, STORE_FILES], 'readwrite');
    tx.objectStore(STORE_SESSIONS).delete(id);
    tx.objectStore(STORE_FILES).delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Xóa toàn bộ dữ liệu lưu trữ
 */
export async function clearAllSessions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SESSIONS, STORE_FILES], 'readwrite');
    tx.objectStore(STORE_SESSIONS).clear();
    tx.objectStore(STORE_FILES).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

import { AppData } from '../types';

const CHUNK_SIZE = 0x8000;

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, Array.from(arr.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface EncryptedVaultBlob {
  saltB64: string;
  iv: string;
  cipher: string;
  pinDisabled?: boolean;
  savedAt?: number;
}

export const WebCryptoVault = {
  async deriveKey(pinOrPass: string, saltB64: string | null): Promise<{ key: CryptoKey; saltB64: string }> {
    const enc = new TextEncoder();
    const salt = saltB64 ? base64ToUint8Array(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(pinOrPass),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 310000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return { key, saltB64: saltB64 || uint8ArrayToBase64(salt) };
  },

  async encrypt(key: CryptoKey, data: any): Promise<{ iv: string; cipher: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return {
      iv: uint8ArrayToBase64(iv),
      cipher: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    };
  },

  async decrypt(key: CryptoKey, ivB64: string, cipherB64: string): Promise<any> {
    const iv = base64ToUint8Array(ivB64);
    const ciphertext = base64ToUint8Array(cipherB64);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  },
};

const DB_NAME = 'PayBackDB';
const STORE_NAME = 'vault';
const LOCAL_STORAGE_KEY = 'payback_vault_v1';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const StorageVault = {
  async saveVault(blob: EncryptedVaultBlob): Promise<EncryptedVaultBlob> {
    const payload = { ...blob, savedAt: Date.now() };
    let savedToIDB = false;

    try {
      const db = await openIndexedDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(payload, 'blob');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      savedToIDB = true;
    } catch {
      // Ignore IDB failure, fallback to localStorage
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      if (!savedToIDB) {
        throw new Error('Could not save vault to IndexedDB or localStorage');
      }
    }

    return payload;
  },

  async loadVault(): Promise<EncryptedVaultBlob | null> {
    let idbBlob: EncryptedVaultBlob | null = null;
    let lsBlob: EncryptedVaultBlob | null = null;

    try {
      const db = await openIndexedDB();
      idbBlob = await new Promise<EncryptedVaultBlob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('blob');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      idbBlob = null;
    }

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      lsBlob = raw ? JSON.parse(raw) : null;
    } catch {
      lsBlob = null;
    }

    if (idbBlob && lsBlob) {
      return (lsBlob.savedAt || 0) > (idbBlob.savedAt || 0) ? lsBlob : idbBlob;
    }
    return idbBlob || lsBlob || null;
  },

  async wipe(): Promise<void> {
    try {
      const db = await openIndexedDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete('blob');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  },
};

export async function encryptData(data: AppData, pin: string): Promise<EncryptedVaultBlob> {
  const { key, saltB64 } = await WebCryptoVault.deriveKey(pin, null);
  const { iv, cipher } = await WebCryptoVault.encrypt(key, data);
  return {
    saltB64,
    iv,
    cipher,
    savedAt: Date.now(),
  };
}

export async function decryptData(blob: EncryptedVaultBlob, pin: string): Promise<AppData | null> {
  try {
    const { key } = await WebCryptoVault.deriveKey(pin, blob.saltB64);
    return await WebCryptoVault.decrypt(key, blob.iv, blob.cipher);
  } catch {
    return null;
  }
}


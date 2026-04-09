import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useDiagramStore } from '@/store/diagramStore';
import { toast } from '@/hooks/use-toast';
import i18n from '@/i18n';
import { STORAGE_KEY_AUTOSAVE_V1, STORAGE_KEY_AUTOSAVE_V2 } from '@/constants/storageKeys';

const STORAGE_KEY = STORAGE_KEY_AUTOSAVE_V2;
const LEGACY_STORAGE_KEY = STORAGE_KEY_AUTOSAVE_V1;
const DEBOUNCE_MS = 1500;

// R15: IndexedDB constants
// I8: IDB_VERSION is a named constant so bumping the schema is one-line change.
//     Increment when adding new object stores or indexes.
const IDB_NAME = 'microflow_autosave';
const IDB_STORE = 'diagrams';
const IDB_KEY = 'current';
const IDB_VERSION = 1;

// PERF-06: Chunk size for binary string assembly during compression
const COMPRESS_CHUNK_SIZE = 8192;

import type { DiagramNode, DiagramEdge } from '@/types/diagram';

// R5-SEC-03: Schema for legacy autosave validation
const LegacyAutoSaveSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  title: z.string().optional(),
  savedAt: z.string().optional(),
});

export interface AutoSaveData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;
  savedAt: string;
  version: '2';
}

export type SaveStatus = 'idle' | 'saving' | 'saved';

// R5-FUNC-02: Check CompressionStream availability
const SUPPORTS_COMPRESSION = typeof CompressionStream !== 'undefined';

// PERF-06: Compress string using CompressionStream
async function compressString(input: string): Promise<string> {
  if (!SUPPORTS_COMPRESSION) {
    const bytes = new TextEncoder().encode(input);
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(binString);
  }
  const blob = new Blob([input]);
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  let binary = '';
  for (let i = 0; i < merged.length; i += COMPRESS_CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, Array.from(merged.subarray(i, i + COMPRESS_CHUNK_SIZE)));
  }
  return btoa(binary);
}

// PERF-06: Decompress base64-encoded gzip string
async function decompressString(base64: string): Promise<string> {
  if (!SUPPORTS_COMPRESSION) {
    const binString = atob(base64);
    const bytes = Uint8Array.from(binString, (ch) => ch.codePointAt(0)!);
    return new TextDecoder().decode(bytes);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes]);
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

// R15 + I8: IndexedDB helpers with versioned schema and migration handler
// PRD-0028 F3-T3: Cached IDB connection to avoid reopening on every call
let cachedDb: IDBDatabase | null = null;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
      void event;
    };
    request.onblocked = () => {
      console.warn('[useAutoSave] IDB upgrade blocked — close other tabs and reload.');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIDB(): Promise<IDBDatabase> {
  if (cachedDb) return cachedDb;
  cachedDb = await openIDB();
  cachedDb.onclose = () => { cachedDb = null; };
  return cachedDb;
}

async function saveToIDB(data: string): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadFromIDB(): Promise<string | null> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function clearIDB(): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function useAutoSave() {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const diagramName = useDiagramStore((s) => s.diagramName);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (nodes.length === 0) return;

    setSaveStatus('saving');

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const data: AutoSaveData = {
        nodes,
        edges,
        title: diagramName,
        savedAt: new Date().toISOString(),
        version: '2',
      };
      try {
        const json = JSON.stringify(data);
        const compressed = await compressString(json);

        // R15: Try IndexedDB first; fall back to localStorage on error
        try {
          await saveToIDB(compressed);
        } catch (idbErr) {
          console.warn('[useAutoSave] IDB write failed, falling back to localStorage:', idbErr);
          localStorage.setItem(STORAGE_KEY, compressed);
        }

        setSaveStatus('saved');
      } catch (e: unknown) {
        // PERF-06: Handle storage quota exceeded
        const eName = e instanceof Error ? e.name : '';
        const eCode = e instanceof DOMException ? e.code : undefined;
        if (eName === 'QuotaExceededError' || eCode === DOMException.QUOTA_EXCEEDED_ERR) {
          toast({
            title: i18n.t('autoSave.storageFull'),
            description: i18n.t('autoSave.storageFullDesc'),
            variant: 'destructive',
          });
        }
        setSaveStatus('idle');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, diagramName]);

  return { saveStatus };
}

export async function getAutoSave(): Promise<AutoSaveData | null> {
  try {
    // R15: Check IndexedDB first
    try {
      const idbData = await loadFromIDB();
      if (idbData) {
        const json = await decompressString(idbData);
        const data = JSON.parse(json) as AutoSaveData;
        if (data.nodes && data.edges) return data;
      }
    } catch {
      // IDB unavailable — fall through to localStorage
    }

    // Fallback: compressed localStorage format (v2)
    const localStorageAvailable = typeof localStorage !== 'undefined';
    if (!localStorageAvailable) return null;

    const compressed = localStorage.getItem(STORAGE_KEY);
    if (compressed) {
      const json = await decompressString(compressed);
      const data = JSON.parse(json) as AutoSaveData;
      if (!data.nodes || !data.edges) return null;
      return data;
    }

    // Fallback: legacy uncompressed format (v1)
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const rawData = JSON.parse(raw);
      const parsed = LegacyAutoSaveSchema.safeParse(rawData);
      if (!parsed.success) return null;
      const data: AutoSaveData = {
        nodes: parsed.data.nodes as DiagramNode[],
        edges: parsed.data.edges as DiagramEdge[],
        title: parsed.data.title ?? i18n.t('autoSave.untitled'),
        savedAt: parsed.data.savedAt ?? new Date().toISOString(),
        version: '2',
      };
      if (!data.nodes.length && !data.edges.length) return null;
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

export function clearAutoSave() {
  // R15: Clear both IndexedDB and localStorage
  clearIDB().catch(() => {});
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  // PRD-0028 F3-T3: Close cached IDB connection
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
}

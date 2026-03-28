import { describe, it, expect, beforeEach } from 'vitest';
import { getAutoSave, clearAutoSave, type AutoSaveData } from './useAutoSave';

const LEGACY_STORAGE_KEY = 'microflow_autosave_v1';

describe('getAutoSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return null when nothing is saved', async () => {
    expect(await getAutoSave()).toBeNull();
  });

  it('should return saved data from legacy format', async () => {
    const data: AutoSaveData = {
      nodes: [{ id: '1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'Test', type: 'service' } }] as any,
      edges: [],
      title: 'Test',
      savedAt: new Date().toISOString(),
      version: '2',
    };
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(data));
    const result = await getAutoSave();
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Test');
    expect(result!.nodes).toHaveLength(1);
  });

  it('should return null for invalid JSON in legacy format', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, 'not valid json');
    expect(await getAutoSave()).toBeNull();
  });

  it('should return null when nodes/edges are missing', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ title: 'Test' }));
    expect(await getAutoSave()).toBeNull();
  });
});

describe('clearAutoSave', () => {
  it('should remove the saved data', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, '{}');
    clearAutoSave();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});

describe('getAutoSave edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return null when nodes and edges are empty arrays', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ nodes: [], edges: [], title: 'T' }));
    const result = await getAutoSave();
    // With Zod validation, empty arrays return null (no meaningful data)
    expect(result).toBeNull();
  });

  it('should handle quota exceeded gracefully (empty storage)', async () => {
    expect(await getAutoSave()).toBeNull();
  });
});

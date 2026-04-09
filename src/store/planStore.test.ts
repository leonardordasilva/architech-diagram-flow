import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanStore, FREE_LIMITS } from './planStore';

const getState = () => usePlanStore.getState();

describe('planStore', () => {
  beforeEach(() => {
    usePlanStore.setState({ limits: FREE_LIMITS, isLoading: true });
  });

  it('initializes with FREE_LIMITS', () => {
    expect(getState().limits).toEqual(FREE_LIMITS);
  });

  it('initializes with isLoading true', () => {
    expect(getState().isLoading).toBe(true);
  });

  it('setLimits updates limits', () => {
    const proLimits = { ...FREE_LIMITS, plan: 'pro' as const, maxDiagrams: null };
    getState().setLimits(proLimits);
    expect(getState().limits.plan).toBe('pro');
    expect(getState().limits.maxDiagrams).toBeNull();
  });

  it('setLoading updates loading state', () => {
    getState().setLoading(false);
    expect(getState().isLoading).toBe(false);
  });
});

/** M4: Centralised localStorage key constants.
 *  Import from here to avoid silent typos when keys are used in multiple places. */

export const STORAGE_KEY_AUTOSAVE_V2 = 'microflow_autosave_v2';
export const STORAGE_KEY_AUTOSAVE_V1 = 'microflow_autosave_v1';

// ─── Timing constants (N4) ────────────────────────────────────────────────────
// Named constants for magic numbers used across the app — update here to tune globally.

/** Minimum ms between consecutive diagram saves (cooldown guard). */
export const SAVE_COOLDOWN_MS = 1_500;
/** React Query staleTime for diagram listings (ms). */
export const STALE_TIME_DIAGRAMS_MS = 60_000;
/** React Query gcTime for diagram listings (ms). */
export const GC_TIME_DIAGRAMS_MS = 600_000;

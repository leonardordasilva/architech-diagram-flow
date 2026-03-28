import { create } from 'zustand';

export interface PlanLimits {
  plan: 'free' | 'pro' | 'team';
  maxDiagrams: number | null;
  maxNodesPerDiagram: number | null;
  maxCollaboratorsPerDiagram: number | null;
  allowedExportFormats: string[];
  watermarkEnabled: boolean;
  realtimeCollabEnabled: boolean;
  emailSharingEnabled: boolean;
}

/** Default limits applied before the RPC resolves (Free tier) */
export const FREE_LIMITS: PlanLimits = {
  plan: 'free',
  maxDiagrams: 3,
  maxNodesPerDiagram: 25,
  maxCollaboratorsPerDiagram: 0,
  allowedExportFormats: ['png', 'json'],
  watermarkEnabled: true,
  realtimeCollabEnabled: false,
  emailSharingEnabled: false,
};

interface PlanStoreState {
  limits: PlanLimits;
  isLoading: boolean;
}

interface PlanStoreActions {
  setLimits: (limits: PlanLimits) => void;
  setLoading: (loading: boolean) => void;
}

export const usePlanStore = create<PlanStoreState & PlanStoreActions>((set) => ({
  limits: FREE_LIMITS,
  isLoading: true,
  setLimits: (limits) => set({ limits }),
  setLoading: (isLoading) => set({ isLoading }),
}));

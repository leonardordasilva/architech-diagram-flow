import { create } from 'zustand';

export interface WorkspaceInfo {
  id: string;
  name: string;
  ownerId: string;
  role: 'owner' | 'editor' | 'viewer';
}

interface WorkspaceStoreState {
  /** null = contexto pessoal; preenchido = editando dentro de um workspace */
  currentWorkspace: WorkspaceInfo | null;
  isLoading: boolean;
}

interface WorkspaceStoreActions {
  setWorkspace: (ws: WorkspaceInfo | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState & WorkspaceStoreActions>((set) => ({
  currentWorkspace: null,
  isLoading: true,
  setWorkspace: (ws) => set({ currentWorkspace: ws }),
  setLoading: (isLoading) => set({ isLoading }),
}));

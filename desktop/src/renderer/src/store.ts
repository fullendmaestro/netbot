import { create } from 'zustand';
import { User } from './firebase';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  selectedProject: string | null;
  setSelectedProject: (projectId: string | null) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  selectedGns3Project: string | null;
  setSelectedGns3Project: (projectId: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  selectedProject: null,
  setSelectedProject: (selectedProject) => set({ selectedProject }),
  activeView: 'Devices',
  setActiveView: (activeView) => set({ activeView }),
  selectedGns3Project: null,
  setSelectedGns3Project: (selectedGns3Project) => set({ selectedGns3Project }),
}));

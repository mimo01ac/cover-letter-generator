import { create } from 'zustand';
import type { Profile, Document, ChatMessage } from '../types';

interface AppState {
  // Profile state
  currentProfile: Profile | null;
  profiles: Profile[];

  // Documents state
  documents: Document[];

  // Chat state
  chatMessages: ChatMessage[];
  currentLetter: string;

  // Loading states
  isGenerating: boolean;

  // Actions
  setCurrentProfile: (profile: Profile | null) => void;
  setProfiles: (profiles: Profile[]) => void;
  setDocuments: (documents: Document[]) => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  setCurrentLetter: (letter: string) => void;

  setIsGenerating: (generating: boolean) => void;

  reset: () => void;
}

const initialState = {
  currentProfile: null,
  profiles: [],
  documents: [],
  chatMessages: [],
  currentLetter: '',
  isGenerating: false,
};

export const useStore = create<AppState>()((set) => ({
  ...initialState,

  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  setProfiles: (profiles) => set({ profiles }),
  setDocuments: (documents) => set({ documents }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  clearChat: () => set({ chatMessages: [], currentLetter: '' }),

  setCurrentLetter: (letter) => set({ currentLetter: letter }),

  setIsGenerating: (generating) => set({ isGenerating: generating }),

  reset: () => set(initialState),
}));

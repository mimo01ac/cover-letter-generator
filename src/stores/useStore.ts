import { create } from 'zustand';
import type { Profile, Document, ChatMessage } from '../types';

interface AppState {
  // Profile state
  currentProfile: Profile | null;
  profiles: Profile[];

  // Documents state
  documents: Document[];

  // Chat state for cover letter
  chatMessages: ChatMessage[];
  currentLetter: string;

  // Summary state
  currentSummary: string;
  summaryChatMessages: ChatMessage[];
  isGeneratingSummary: boolean;

  // Loading states
  isGenerating: boolean;

  // Actions
  setCurrentProfile: (profile: Profile | null) => void;
  setProfiles: (profiles: Profile[]) => void;
  setDocuments: (documents: Document[]) => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  setCurrentLetter: (letter: string) => void;

  // Summary actions
  setCurrentSummary: (summary: string) => void;
  addSummaryChatMessage: (message: ChatMessage) => void;
  clearSummaryChat: () => void;
  setIsGeneratingSummary: (generating: boolean) => void;

  setIsGenerating: (generating: boolean) => void;

  reset: () => void;
}

const initialState = {
  currentProfile: null,
  profiles: [],
  documents: [],
  chatMessages: [],
  currentLetter: '',
  currentSummary: '',
  summaryChatMessages: [],
  isGeneratingSummary: false,
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

  // Summary actions
  setCurrentSummary: (summary) => set({ currentSummary: summary }),

  addSummaryChatMessage: (message) =>
    set((state) => ({
      summaryChatMessages: [...state.summaryChatMessages, message],
    })),

  clearSummaryChat: () => set({ summaryChatMessages: [], currentSummary: '' }),

  setIsGeneratingSummary: (generating) => set({ isGeneratingSummary: generating }),

  setIsGenerating: (generating) => set({ isGenerating: generating }),

  reset: () => set(initialState),
}));

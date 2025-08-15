import { create } from 'zustand';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean; // typing indicator / in-progress
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error?: string;
  start: (systemMsg?: string) => void;
  addUser: (content: string) => void;
  startAssistant: () => string;          // returns message id for the streaming msg
  appendTo: (id: string, delta: string) => void;
  finish: (id: string) => void;
  setError: (err?: string) => void;
  reset: () => void;
}

const newId = () => Math.random().toString(36).slice(2);

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  error: undefined,
  start: (systemMsg) => set({
    messages: systemMsg ? [{ id: newId(), role: 'system', content: systemMsg }] : [],
    loading: false,
    error: undefined,
  }),
  addUser: (content) =>
    set((s) => ({ messages: [...s.messages, { id: newId(), role: 'user', content }] })),
  startAssistant: () => {
    const id = newId();
    set((s) => ({
      loading: true,
      messages: [...s.messages, { id, role: 'assistant', content: '', streaming: true }],
    }));
    return id;
  },
  appendTo: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    })),
  finish: (id) =>
    set((s) => ({
      loading: false,
      messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
    })),
  setError: (err) => set({ error: err, loading: false }),
  reset: () => set({ messages: [], loading: false, error: undefined }),
}));

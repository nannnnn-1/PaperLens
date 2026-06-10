import { create } from 'zustand';
import type { Citation } from '@/types/api';
import { readingApi } from '@/lib/api';

interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessageUI[];
  sessions: Array<{ id: string; paperId: string; createdAt: string }>;
  currentSessionId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // actions
  openChat: () => void;
  closeChat: () => void;
  loadHistory: (paperId: string, sessionId?: string) => Promise<void>;
  sendMessage: (paperId: string, question: string, selectedText?: string, surroundingBlockIds?: string[]) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessions: [],
  currentSessionId: null,
  isOpen: false,
  isLoading: false,
  error: null,

  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  loadHistory: async (paperId, sessionId) => {
    try {
      const res = await readingApi.qas(paperId, sessionId);
      const msgs: ChatMessageUI[] = [];
      res.list.forEach((qa) => {
        msgs.push({ id: `${qa.id}-q`, role: 'user', content: qa.question });
        msgs.push({ id: `${qa.id}-a`, role: 'assistant', content: qa.answer });
      });
      set({ messages: msgs, sessions: res.sessions, currentSessionId: sessionId || null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载历史失败' });
    }
  },

  sendMessage: async (paperId, question, selectedText, surroundingBlockIds) => {
    const sessionId = get().currentSessionId || undefined;
    set((state) => ({
      messages: [
        ...state.messages,
        { id: `u-${Date.now()}`, role: 'user', content: question },
        { id: `a-${Date.now()}`, role: 'assistant', content: '', isStreaming: true },
      ],
      isLoading: true,
      error: null,
    }));

    const userMsg = question;
    const assistantId = `a-${Date.now()}`;

    try {
      const res = await readingApi.ask(paperId, {
        question: userMsg,
        selectedText,
        surroundingBlockIds,
        sessionId,
      });

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId
            ? { ...m, content: res.answer, citations: res.citations, isStreaming: false }
            : m
        ),
        currentSessionId: res.sessionId,
        isLoading: false,
      }));
    } catch (e) {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, content: '抱歉，请求出错，请重试。', isStreaming: false } : m
        ),
        isLoading: false,
        error: e instanceof Error ? e.message : '请求失败',
      }));
    }
  },

  clearMessages: () => set({ messages: [], currentSessionId: null }),
  clearError: () => set({ error: null }),
}));

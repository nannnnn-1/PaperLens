import { create } from 'zustand';
import type { UserProfile } from '@/types/api';
import { authApi, userApi } from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  // actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isHydrated: false,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem('accessToken', res.token);
      localStorage.setItem('refreshToken', res.refreshToken);
      set({ user: res.user, token: res.token, refreshToken: res.refreshToken, isLoading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '登录失败', isLoading: false });
      throw e;
    }
  },

  register: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register({ email, password, displayName });
      localStorage.setItem('accessToken', res.token);
      localStorage.setItem('refreshToken', res.refreshToken);
      set({ user: res.user, token: res.token, refreshToken: res.refreshToken, isLoading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '注册失败', isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, token: null, refreshToken: null });
    }
  },

  hydrate: () => {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (token) {
      set({ token, refreshToken, isHydrated: true });
      userApi
        .me()
        .then((user) => set({ user }))
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ token: null, refreshToken: null });
        });
    } else {
      set({ isHydrated: true });
    }
  },

  clearError: () => set({ error: null }),
}));

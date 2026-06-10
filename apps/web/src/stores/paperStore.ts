import { create } from 'zustand';
import type { PaperMeta, PaperDetail } from '@/types/api';
import { paperApi, fileApi } from '@/lib/api';

interface PaperState {
  papers: PaperMeta[];
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
  currentPaper: PaperDetail | null;
  isLoading: boolean;
  error: string | null;
  uploadProgress: number;

  // actions
  fetchPapers: (params?: { page?: number; limit?: number; status?: string; favorite?: boolean; q?: string }) => Promise<void>;
  fetchPaperDetail: (id: string) => Promise<void>;
  uploadPaper: (file: File) => Promise<PaperMeta>;
  favoritePaper: (id: string, isFavorite: boolean) => Promise<void>;
  deletePaper: (id: string) => Promise<void>;
  clearError: () => void;
}

export const usePaperStore = create<PaperState>((set) => ({
  papers: [],
  pagination: null,
  currentPaper: null,
  isLoading: false,
  error: null,
  uploadProgress: 0,

  fetchPapers: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await paperApi.list(params);
      set({ papers: res.list, pagination: res.pagination, isLoading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取论文列表失败', isLoading: false });
    }
  },

  fetchPaperDetail: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const paper = await paperApi.detail(id);
      set({ currentPaper: paper, isLoading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取论文详情失败', isLoading: false });
    }
  },

  uploadPaper: async (file) => {
    set({ uploadProgress: 0, error: null });
    try {
      const presign = await fileApi.presignUpload({
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
      });

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            set({ uploadProgress: Math.round((e.loaded / e.total) * 100) });
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error('上传失败'));
        });
        xhr.addEventListener('error', () => reject(new Error('上传失败')));
        xhr.open('PUT', presign.presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
        xhr.send(file);
      });

      const res = await paperApi.uploadComplete({
        objectKey: presign.objectKey,
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/pdf',
      });

      set({ uploadProgress: 100 });
      return res.paper;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '上传失败' });
      throw e;
    }
  },

  favoritePaper: async (id, isFavorite) => {
    try {
      const updated = await paperApi.favorite(id, isFavorite);
      set((state) => ({
        papers: state.papers.map((p) => (p.id === id ? updated : p)),
        currentPaper: state.currentPaper?.id === id ? { ...state.currentPaper, isFavorite: updated.isFavorite } : state.currentPaper,
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '操作失败' });
    }
  },

  deletePaper: async (id) => {
    try {
      await paperApi.remove(id);
      set((state) => ({
        papers: state.papers.filter((p) => p.id !== id),
        currentPaper: state.currentPaper?.id === id ? null : state.currentPaper,
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '删除失败' });
    }
  },

  clearError: () => set({ error: null }),
}));

import { create } from 'zustand';
import type {
  SemanticBlock,
  Annotation,
  AnnotationType,
  Figure,
  FigureDetail,
  MethodCard,
  Note,
  OutlineNode,
  ReadingArchive,
  TermDefinition,
} from '@/types/api';
import { readingApi, termApi } from '@/lib/api';

interface ReadingState {
  blocks: SemanticBlock[];
  annotations: Annotation[];
  figures: Figure[];
  methodCards: MethodCard[];
  notes: Note[];
  outline: OutlineNode[];
  archive: ReadingArchive | null;
  currentFigure: FigureDetail | null;
  selectedBlockId: string | null;
  selectedText: string | null;
  hoveredAnnotationId: string | null;
  isAnnotationDrawerOpen: boolean;
  isLoading: boolean;
  error: string | null;
  termCache: Map<string, TermDefinition>;

  // actions
  fetchBlocks: (paperId: string) => Promise<void>;
  fetchAnnotations: (paperId: string, type?: AnnotationType) => Promise<void>;
  addAnnotation: (paperId: string, annotation: Omit<Annotation, 'id' | 'createdAt' | 'createdBy' | 'userId'>) => Promise<void>;
  removeAnnotation: (paperId: string, annotationId: string) => Promise<void>;
  fetchFigures: (paperId: string) => Promise<void>;
  fetchFigureDetail: (paperId: string, figureId: string) => Promise<void>;
  fetchMethodCards: (paperId: string) => Promise<void>;
  fetchNotes: (paperId: string) => Promise<void>;
  addNote: (paperId: string, content: string, blockId?: string, color?: string) => Promise<void>;
  fetchOutline: (paperId: string) => Promise<void>;
  fetchArchive: (paperId: string) => Promise<void>;
  lookupTerm: (term: string) => Promise<TermDefinition | null>;
  setSelectedBlockId: (id: string | null) => void;
  setSelectedText: (text: string | null) => void;
  setHoveredAnnotationId: (id: string | null) => void;
  setAnnotationDrawerOpen: (open: boolean) => void;
  clearError: () => void;
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  blocks: [],
  annotations: [],
  figures: [],
  methodCards: [],
  notes: [],
  outline: [],
  archive: null,
  currentFigure: null,
  selectedBlockId: null,
  selectedText: null,
  hoveredAnnotationId: null,
  isAnnotationDrawerOpen: false,
  isLoading: false,
  error: null,
  termCache: new Map(),

  fetchBlocks: async (paperId) => {
    try {
      const res = await readingApi.blocks(paperId, { limit: 1000 });
      set({ blocks: res.list });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取语义块失败' });
    }
  },

  fetchAnnotations: async (paperId, type) => {
    try {
      const res = await readingApi.annotations(paperId, type);
      set({ annotations: res.list });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取标注失败' });
    }
  },

  addAnnotation: async (paperId, annotation) => {
    try {
      const res = await readingApi.addAnnotation(paperId, annotation);
      set((state) => ({ annotations: [...state.annotations, res] }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '添加标注失败' });
    }
  },

  removeAnnotation: async (paperId, annotationId) => {
    try {
      await readingApi.removeAnnotation(paperId, annotationId);
      set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== annotationId),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '删除标注失败' });
    }
  },

  fetchFigures: async (paperId) => {
    try {
      const res = await readingApi.figures(paperId);
      set({ figures: res.list });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取图表失败' });
    }
  },

  fetchFigureDetail: async (paperId, figureId) => {
    try {
      const res = await readingApi.figure(paperId, figureId);
      set({ currentFigure: res });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取图表详情失败' });
    }
  },

  fetchMethodCards: async (paperId) => {
    try {
      const res = await readingApi.methodCards(paperId);
      set({ methodCards: res.list });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取方法卡片失败' });
    }
  },

  fetchNotes: async (paperId) => {
    try {
      const res = await readingApi.notes(paperId);
      set({ notes: res.list });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取笔记失败' });
    }
  },

  addNote: async (paperId, content, blockId, color) => {
    try {
      const res = await readingApi.addNote(paperId, { content, blockId, color });
      set((state) => ({ notes: [...state.notes, res] }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '添加笔记失败' });
    }
  },

  fetchOutline: async (paperId) => {
    try {
      const res = await readingApi.outline(paperId);
      set({ outline: res.chapters });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取大纲失败' });
    }
  },

  fetchArchive: async (paperId) => {
    set({ isLoading: true });
    try {
      const res = await readingApi.archive(paperId);
      set({ archive: res, isLoading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取档案失败', isLoading: false });
    }
  },

  lookupTerm: async (term) => {
    const cache = get().termCache;
    if (cache.has(term)) return cache.get(term)!;
    try {
      const res = await termApi.detail(term);
      set((state) => {
        const next = new Map(state.termCache);
        next.set(term, res);
        return { termCache: next };
      });
      return res;
    } catch {
      return null;
    }
  },

  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
  setSelectedText: (text) => set({ selectedText: text }),
  setHoveredAnnotationId: (id) => set({ hoveredAnnotationId: id }),
  setAnnotationDrawerOpen: (open) => set({ isAnnotationDrawerOpen: open }),
  clearError: () => set({ error: null }),
}));

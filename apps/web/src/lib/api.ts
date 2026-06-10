import type {
  ApiResponse,
  PaginatedResponse,
  UserProfile,
  PaperMeta,
  PaperDetail,
  SemanticBlock,
  Annotation,
  AnnotationType,
  Figure,
  FigureDetail,
  MethodCard,
  PaperQA,
  Note,
  OutlineNode,
  ReadingArchive,
  TermDefinition,
  Citation,
} from '@/types/api';

const BASE_URL = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (json.code >= 400) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json.data;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);
const del = <T>(path: string) => request<T>('DELETE', path);

// ==================== Auth ====================
export interface AuthResult {
  user: UserProfile;
  token: string;
  refreshToken: string;
}

export const authApi = {
  register: (body: { email: string; password: string; displayName?: string }) =>
    post<AuthResult>('/auth/register', body),
  login: (body: { email: string; password: string }) =>
    post<AuthResult>('/auth/login', body),
  refresh: (refreshToken: string) =>
    post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken }),
  logout: () => post<{ success: boolean }>('/auth/logout'),
};

// ==================== User ====================
export const userApi = {
  me: () => get<UserProfile>('/users/me'),
  updateMe: (body: { displayName?: string; avatarUrl?: string }) =>
    patch<UserProfile>('/users/me', body),
  interests: () => get<{ interests: import('@/types/api').Interest[] }>('/users/me/interests'),
  addInterest: (keyword: string) => post<import('@/types/api').Interest>('/users/me/interests', { keyword }),
  removeInterest: (id: string) => del<{ success: boolean }>(`/users/me/interests/${id}`),
  settings: () => get<import('@/types/api').UserSettings>('/users/me/settings'),
  updateSettings: (body: Partial<import('@/types/api').UserSettings>) =>
    patch<import('@/types/api').UserSettings>('/users/me/settings', body),
};

// ==================== Paper ====================
export const paperApi = {
  list: (params?: { page?: number; limit?: number; status?: string; favorite?: boolean; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.favorite !== undefined) qs.set('favorite', String(params.favorite));
    if (params?.q) qs.set('q', params.q);
    return get<PaginatedResponse<PaperMeta>>(`/papers?${qs.toString()}`);
  },
  create: (body: { title: string; authors: import('@/types/api').Author[]; abstract?: string; sourceUrl?: string; arxivId?: string }) =>
    post<PaperMeta>('/papers', body),
  detail: (id: string) => get<PaperDetail>(`/papers/${id}`),
  remove: (id: string) => del<{ success: boolean }>(`/papers/${id}`),
  uploadComplete: (body: { objectKey: string; filename: string; size: number; mimeType: string }) =>
    post<{ paper: PaperMeta }>('/papers/upload-complete', body),
  download: (id: string) => get<string>(`/papers/${id}/download`),
  reparse: (id: string) => post<{ jobId: string }>(`/papers/${id}/reparse`),
  translate: (id: string, targetLang?: string) =>
    post<{ paperId: string; status: string }>(`/papers/${id}/translate`, { targetLang }),
  updateProgress: (id: string, progress: number) =>
    patch<PaperMeta>(`/papers/${id}/progress`, { progress }),
  favorite: (id: string, isFavorite: boolean) =>
    post<PaperMeta>(`/papers/${id}/favorite`, { isFavorite }),
};

// ==================== Reading ====================
export const readingApi = {
  blocks: (paperId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return get<PaginatedResponse<SemanticBlock>>(`/papers/${paperId}/blocks?${qs.toString()}`);
  },
  block: (paperId: string, blockId: string) =>
    get<SemanticBlock>(`/papers/${paperId}/blocks/${blockId}`),
  annotations: (paperId: string, type?: AnnotationType) => {
    const qs = new URLSearchParams();
    if (type) qs.set('type', type);
    return get<{ list: Annotation[] }>(`/papers/${paperId}/annotations?${qs.toString()}`);
  },
  addAnnotation: (paperId: string, body: Omit<Annotation, 'id' | 'createdAt' | 'createdBy' | 'userId'>) =>
    post<Annotation>(`/papers/${paperId}/annotations`, body),
  removeAnnotation: (paperId: string, annotationId: string) =>
    del<{ success: boolean }>(`/papers/${paperId}/annotations/${annotationId}`),
  figures: (paperId: string) => get<{ list: Figure[] }>(`/papers/${paperId}/figures`),
  figure: (paperId: string, figureId: string) =>
    get<FigureDetail>(`/papers/${paperId}/figures/${figureId}`),
  figureImage: (paperId: string, figureId: string, size: 'original' | 'thumb' = 'original') =>
    `${BASE_URL}/papers/${paperId}/figures/${figureId}/image?size=${size}`,
  methodCards: (paperId: string) =>
    get<{ list: MethodCard[] }>(`/papers/${paperId}/method-cards`),
  updateMethodCard: (paperId: string, cardId: string, body: Partial<MethodCard>) =>
    patch<MethodCard>(`/papers/${paperId}/method-cards/${cardId}`, body),
  qas: (paperId: string, sessionId?: string) => {
    const qs = new URLSearchParams();
    if (sessionId) qs.set('sessionId', sessionId);
    return get<{ list: PaperQA[]; sessions: import('@/types/api').QASession[] }>(`/papers/${paperId}/qas?${qs.toString()}`);
  },
  ask: (paperId: string, body: { question: string; selectedText?: string; surroundingBlockIds?: string[]; sessionId?: string }) =>
    post<{ answer: string; sessionId: string; citations?: Citation[] }>(`/papers/${paperId}/qas`, body),
  feedback: (paperId: string, qaId: string, body: { isHelpful: boolean; correction?: string }) =>
    post<{ success: boolean }>(`/papers/${paperId}/qas/${qaId}/feedback`, body),
  notes: (paperId: string) => get<{ list: Note[] }>(`/papers/${paperId}/notes`),
  addNote: (paperId: string, body: { content: string; blockId?: string; color?: string }) =>
    post<Note>(`/papers/${paperId}/notes`, body),
  updateNote: (paperId: string, noteId: string, body: { content?: string; color?: string }) =>
    patch<Note>(`/papers/${paperId}/notes/${noteId}`, body),
  removeNote: (paperId: string, noteId: string) =>
    del<{ success: boolean }>(`/papers/${paperId}/notes/${noteId}`),
  outline: (paperId: string) => get<{ chapters: OutlineNode[] }>(`/papers/${paperId}/outline`),
  archive: (paperId: string) => get<ReadingArchive>(`/papers/${paperId}/archive`),
};

// ==================== Chat ====================
export const chatApi = {
  paperChat: (body: {
    paperId: string;
    question: string;
    selectedText?: string;
    surroundingBlockIds?: string[];
    sessionId?: string;
    stream?: boolean;
  }) =>
    post<{ reply: string; sessionId: string; citations?: Citation[] }>('/chat/paper', body),
};

// ==================== Term ====================
export const termApi = {
  search: (q: string, type?: AnnotationType) => {
    const qs = new URLSearchParams();
    qs.set('q', q);
    if (type) qs.set('type', type);
    return get<{ list: TermDefinition[] }>(`/terms?${qs.toString()}`);
  },
  detail: (term: string) => get<TermDefinition>(`/terms/${encodeURIComponent(term)}`),
  add: (body: { term: string; definition: string; category?: AnnotationType; aliases?: string[] }) =>
    post<TermDefinition>('/terms', body),
};

// ==================== File ====================
export const fileApi = {
  presignUpload: (body: { filename: string; mimeType: string; size: number }) =>
    post<{ presignedUrl: string; objectKey: string; publicUrl: string }>('/files/presign-upload', body),
  presignDownload: (objectKey: string) =>
    post<{ presignedUrl: string }>('/files/presign-download', { objectKey }),
};

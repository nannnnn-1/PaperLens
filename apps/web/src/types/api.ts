// ==================== 通用 ====================
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  requestId: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  pagination: Pagination;
}

// ==================== 用户域 ====================
export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  createdAt: string;
}

export interface Interest {
  id: string;
  keyword: string;
  weight: number;
  source: 'MANUAL' | 'AUTO_RECOMMENDED';
}

export interface UserSettings {
  pushMorning: boolean;
  pushEvening: boolean;
  pushInstant: boolean;
  languageUi: string;
  languageTranslate: string;
}

export interface ReadingStat {
  date: string;
  papersCount: number;
  questionsCount: number;
  notesCount: number;
  correctionsCount: number;
  readingMinutes: number;
  continuousDays: number;
}

// ==================== 论文域 ====================
export interface Author {
  name: string;
  affiliation?: string;
}

export interface PaperMeta {
  id: string;
  title: string;
  titleTranslated?: string;
  authors: Author[];
  sourceType: 'ARXIV' | 'UPLOAD' | 'MANUAL';
  sourceUrl?: string;
  arxivId?: string;
  parseStatus: 'UPLOADED' | 'QUEUED' | 'PARSING' | 'PARSED' | 'FAILED';
  parseError?: string;
  readingProgress: number;
  isFavorite: boolean;
  createdAt: string;
}

export interface PaperDetail extends PaperMeta {
  abstract?: string;
  abstractTranslated?: string;
  doi?: string;
  publishedAt?: string;
  fileInfo: {
    objectKey: string;
    fileSize: number;
    mimeType: string;
  };
  methodSummary?: {
    methods: Array<{
      name: string;
      dataset?: string;
      metric?: string;
      value?: string;
    }>;
  };
}

// ==================== 阅读室域 ====================
export interface SemanticBlock {
  id: string;
  blockIndex: number;
  blockType: 'PARAGRAPH' | 'HEADING' | 'FORMULA' | 'CAPTION';
  level?: number;
  content: string;
  translation?: string;
  pageNumber?: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

export type AnnotationType = 'ALGORITHM' | 'CONCEPT' | 'DATASET_METRIC' | 'CITATION' | 'CODE_TOOL';

export interface EvidenceItem {
  type: 'TEXT' | 'FIGURE' | 'TABLE';
  blockId?: string;
  figureId?: string;
  excerpt: string;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  text: string;
  label?: string;
  definition?: string;
  evidence?: EvidenceItem[];
  createdBy: 'AGENT' | 'USER';
  userId?: string;
  createdAt: string;
}

export interface Figure {
  id: string;
  figureIndex: number;
  caption?: string;
  captionTranslated?: string;
  thumbUrl: string;
  aiAnalysis?: string;
  pageNumber?: number;
}

export interface FigureDetail extends Figure {
  imageUrl: string;
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface Metric {
  name: string;
  value: number | string;
  unit?: string;
}

export interface MethodCard {
  id: string;
  name: string;
  category?: string;
  backbone?: string;
  datasets: Array<{ name: string; splits?: string }>;
  metrics: Metric[];
  paramsCount?: string;
  isCodeAvailable?: boolean;
  codeUrl?: string;
  evidence?: EvidenceItem[];
  createdBy: 'AGENT' | 'USER';
}

export interface PaperQA {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  context?: {
    selectedText?: string;
    surroundingBlockIds?: string[];
  };
  isHelpful?: boolean;
  correction?: string;
  createdAt: string;
}

export interface QASession {
  id: string;
  paperId: string;
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  blockId?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutlineNode {
  id: string;
  blockId: string;
  title: string;
  level: number;
  children?: OutlineNode[];
}

export interface ReadingArchive {
  paperId: string;
  methodCards: MethodCard[];
  qaCount: number;
  noteCount: number;
  annotationCount: number;
  agentLogs: Array<{
    agentType: string;
    action: string;
    createdAt: string;
  }>;
}

// ==================== AI 对话域 ====================
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Citation {
  paperId: string;
  paperIndex: number;
  blockId?: string;
  excerpt: string;
}

// ==================== 项目域 ====================
export interface Project {
  id: string;
  name: string;
  description?: string;
  topicTags: string[];
  paperCount: number;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  papers: PaperMeta[];
  matrix?: ComparisonMatrix;
  timeline?: { nodes: TimelineNode[]; edges: TimelineEdge[] };
}

export interface ProjectPaper {
  id: string;
  paperId: string;
  sortOrder: number;
  addedAt: string;
}

// ==================== 对比矩阵域 ====================
export interface MatrixColumn {
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'URL';
  source: 'PRESET' | 'AGENT' | 'USER';
}

export interface MatrixCell {
  id: string;
  paperId: string;
  columnKey: string;
  value?: string;
  rawValue?: unknown;
  evidence?: EvidenceItem[];
  isConflict: boolean;
  conflictReason?: string;
  isUserCorrected: boolean;
  correctedAt?: string;
}

export interface ComparisonMatrix {
  id: string;
  columns: MatrixColumn[];
  cells: MatrixCell[];
}

export interface EvidenceDrawer {
  cell: MatrixCell;
  paper: PaperMeta;
  sourceBlocks: SemanticBlock[];
  sourceFigures: Figure[];
}

export interface Conflict {
  cellId: string;
  paperId: string;
  columnKey: string;
  detectedValue: string;
  conflictingValue: string;
  reason: string;
}

// ==================== 方法演进域 ====================
export interface TimelineNode {
  id: string;
  methodName: string;
  paperId: string;
  year: number;
  summary?: string;
  improvements: Array<{
    aspect: string;
    description: string;
  }>;
}

export interface TimelineEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

// ==================== 简报域 ====================
export interface Briefing {
  id: string;
  type: 'MORNING' | 'EVENING';
  title: string;
  generatedAt: string;
  isRead: boolean;
}

export interface BriefingDetail extends Briefing {
  content: {
    stats?: {
      papersRead: number;
      questions: number;
      notes: number;
      readingMinutes: number;
    };
    trends?: {
      chartData: Array<{ date: string; count: number }>;
      insight: string;
    };
    recommendations?: Array<{
      paperId: string;
      reason: string;
    }>;
    previews?: Array<{
      event: string;
      time: string;
    }>;
    paperCards?: Array<{
      paperId: string;
      title: string;
      aiSummary: string;
      relevance: 'HIGH' | 'MAYBE';
    }>;
  };
}

// ==================== 术语域 ====================
export interface TermDefinition {
  id: string;
  term: string;
  definition: string;
  category?: AnnotationType;
  sourcePaperId?: string;
  aliases: string[];
  usageCount: number;
}

// ==================== SSE 事件 ====================
export interface SSEChatDelta {
  sessionId: string;
  delta: string;
  finish: boolean;
}

export interface SSEChatDone {
  sessionId: string;
  finish: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface SSEParseProgress {
  paperId: string;
  status: string;
  progress: number;
}

export interface SSEParseComplete {
  paperId: string;
  status: 'PARSED' | 'FAILED';
  error?: string;
}

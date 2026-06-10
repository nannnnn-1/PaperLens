"""Shared Pydantic schemas for request/response models."""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== Envelope ====================


class ApiResponse(BaseModel):
    """Unified API response envelope."""

    code: int = 200
    data: Any = None
    message: str = "success"
    request_id: str = Field(default="", alias="requestId")

    model_config = {"populate_by_name": True}


# ==================== Parse ====================


class ParseRequest(BaseModel):
    paper_id: str
    file_url: str


class ParseResponse(BaseModel):
    job_id: str
    status: str


class ParseStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[float] = None
    error: Optional[str] = None


class ParseJobPayload(BaseModel):
    job_id: str
    paper_id: str
    file_url: str


class ParseCallbackPayload(BaseModel):
    job_id: str
    paper_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class ParseCallbackAck(BaseModel):
    received: bool = True


# ==================== Semantic Blocks ====================


class BlockType(str, Enum):
    PARAGRAPH = "PARAGRAPH"
    HEADING = "HEADING"
    FORMULA = "FORMULA"
    CAPTION = "CAPTION"


class BBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class SemanticBlock(BaseModel):
    block_index: int
    block_type: BlockType = BlockType.PARAGRAPH
    level: Optional[int] = None
    content: str
    translation: Optional[str] = None
    page_number: Optional[int] = None
    bbox: Optional[BBox] = None


# ==================== Annotations ====================


class AnnotationType(str, Enum):
    ALGORITHM = "ALGORITHM"
    CONCEPT = "CONCEPT"
    DATASET_METRIC = "DATASET_METRIC"
    CITATION = "CITATION"
    CODE_TOOL = "CODE_TOOL"


class EvidenceItem(BaseModel):
    type: str = "TEXT"
    block_id: Optional[str] = None
    figure_id: Optional[str] = None
    excerpt: str


class Annotation(BaseModel):
    type: AnnotationType
    text: str
    label: Optional[str] = None
    definition: Optional[str] = None
    evidence: List[EvidenceItem] = Field(default_factory=list)


# ==================== Figures ====================


class Figure(BaseModel):
    figure_index: int
    caption: Optional[str] = None
    caption_translated: Optional[str] = None
    page_number: Optional[int] = None
    bbox: Optional[BBox] = None


# ==================== Method Cards ====================


class Metric(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None


class Dataset(BaseModel):
    name: str
    splits: Optional[str] = None


class MethodCard(BaseModel):
    name: str
    category: Optional[str] = None
    backbone: Optional[str] = None
    datasets: List[Dataset] = Field(default_factory=list)
    metrics: List[Metric] = Field(default_factory=list)
    params_count: Optional[str] = None
    is_code_available: Optional[bool] = None
    code_url: Optional[str] = None
    evidence: List[EvidenceItem] = Field(default_factory=list)


# ==================== Translate ====================


class TranslateRequest(BaseModel):
    blocks: List[SemanticBlock]
    target_lang: str = "zh"


class TranslateResponse(BaseModel):
    translations: List[SemanticBlock]


# ==================== Terms ====================


class TermItem(BaseModel):
    term: str
    definition: str
    category: Optional[AnnotationType] = None


class TermsExtractRequest(BaseModel):
    text: str
    context: Optional[str] = None


class TermsExtractResponse(BaseModel):
    terms: List[TermItem]


# ==================== Chat ====================


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: bool = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048


class ChatResponse(BaseModel):
    reply: str
    finish: bool = True


# ==================== Embeddings ====================


class EmbeddingsRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = None


class EmbeddingsResponse(BaseModel):
    embeddings: List[List[float]]
    model: str


# ==================== Worker Result ====================


class ParsedPaperResult(BaseModel):
    blocks: List[SemanticBlock]
    annotations: List[Annotation]
    figures: List[Figure]
    method_cards: List[MethodCard]
    embeddings: List[List[float]]

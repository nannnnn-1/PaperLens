"""Batch embeddings endpoint."""

import openai
from fastapi import APIRouter, Depends, Request

from app.config import settings
from app.schemas import ApiResponse, EmbeddingsRequest, EmbeddingsResponse
from app.services.embedder import Embedder

router = APIRouter(tags=["embeddings"])


def _get_embedding_client(request: Request) -> openai.AsyncOpenAI:
    return request.app.state.embedding_client


@router.post("/embeddings", response_model=ApiResponse)
async def create_embeddings(
    req: EmbeddingsRequest,
    openai_client: openai.AsyncOpenAI = Depends(_get_embedding_client),
) -> ApiResponse:
    """Generate embeddings for a batch of texts."""
    embedder = Embedder(openai_client)
    embeddings = await embedder.embed_batch(req.texts)
    return ApiResponse(
        data=EmbeddingsResponse(
            embeddings=embeddings,
            model=req.model or settings.OPENAI_EMBEDDING_MODEL,
        ),
    )

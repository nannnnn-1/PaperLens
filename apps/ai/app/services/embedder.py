"""Embedding generation service."""

import asyncio
from typing import List

import openai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings

BATCH_SIZE = 32


class Embedder:
    """OpenAI-compatible embedding client with retry."""

    def __init__(self, client: openai.AsyncOpenAI) -> None:
        self.client = client
        self.model = settings.OPENAI_EMBEDDING_MODEL

    @retry(
        retry=retry_if_exception_type((openai.APIError, openai.APITimeoutError)),
        stop=stop_after_attempt(settings.LLM_MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of texts in batched calls."""
        if not texts:
            return []

        results: List[List[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i + BATCH_SIZE]
            resp = await asyncio.wait_for(
                self.client.embeddings.create(
                    model=self.model,
                    input=batch,
                ),
                timeout=settings.LLM_TIMEOUT,
            )
            batch_results = [item.embedding for item in resp.data]
            results.extend(batch_results)
        return results

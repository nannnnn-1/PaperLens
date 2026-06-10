"""Async OpenAI-compatible LLM client with retry and timeout."""

import asyncio
import json
from typing import Any, AsyncIterator, Dict, List, Optional

import openai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings


class LLMClient:
    """Thin wrapper around openai.AsyncOpenAI with retry & timeout."""

    def __init__(self) -> None:
        self.client = openai.AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-no-key",
            base_url=settings.OPENAI_BASE_URL,
            timeout=settings.LLM_TIMEOUT,
            max_retries=0,  # we handle retry manually
        )
        self.model = settings.OPENAI_MODEL

    @retry(
        retry=retry_if_exception_type((openai.APIError, openai.APITimeoutError)),
        stop=stop_after_attempt(settings.LLM_MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = 2048,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        """Call the chat completion endpoint and return content string."""
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        if response_format is not None:
            kwargs["response_format"] = response_format

        try:
            resp = await asyncio.wait_for(
                self.client.chat.completions.create(**kwargs),
                timeout=settings.LLM_TIMEOUT,
            )
        except asyncio.TimeoutError as exc:
            raise openai.APITimeoutError(message="LLM request timed out") from exc

        content = resp.choices[0].message.content
        return content or ""

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = 2048,
    ) -> AsyncIterator[str]:
        """Stream chat completion content chunks."""
        try:
            stream = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                ),
                timeout=settings.LLM_TIMEOUT,
            )
        except asyncio.TimeoutError as exc:
            raise openai.APITimeoutError(message="LLM request timed out") from exc

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def extract_json(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: Optional[int] = 4096,
    ) -> Dict[str, Any]:
        """Call chat completion with JSON mode and parse result."""
        content = await self.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(f"LLM returned invalid JSON: {content[:200]}") from exc

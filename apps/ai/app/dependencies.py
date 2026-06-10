"""FastAPI dependency providers."""

from typing import AsyncGenerator

import httpx
import redis.asyncio as redis
from fastapi import Request

from app.services.redis_client import create_redis_client


async def get_redis() -> AsyncGenerator[redis.Redis, None]:
    """Yield an async Redis client."""
    client = create_redis_client()
    try:
        yield client
    finally:
        await client.close()


def get_http_client(request: Request) -> httpx.AsyncClient:
    """Return the shared httpx AsyncClient from app state."""
    return request.app.state.http_client


def get_openai_client(request: Request):
    """Return the shared OpenAI async client from app state."""
    return request.app.state.openai_client

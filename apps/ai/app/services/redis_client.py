"""Redis helpers for queue operations and job status."""

import json
from typing import Any, Dict, Optional

import redis.asyncio as redis

from app.config import settings
from app.schemas import ParseJobPayload, ParseStatusResponse


def create_redis_client() -> redis.Redis:
    """Create an async Redis client with appropriate timeouts."""
    return redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_timeout=15,
        socket_connect_timeout=5,
    )


def _job_key(job_id: str) -> str:
    return f"{settings.REDIS_JOB_KEY_PREFIX}:{job_id}"


async def enqueue_parse_job(
    redis_client: redis.Redis,
    payload: ParseJobPayload,
) -> None:
    """Push a parse job to the Redis list and initialize its status."""
    job_id = payload.job_id
    await redis_client.hset(
        _job_key(job_id),
        mapping={
            "status": "QUEUED",
            "paper_id": payload.paper_id,
            "file_url": payload.file_url,
            "progress": "0",
            "error": "",
        },
    )
    await redis_client.lpush(
        settings.REDIS_QUEUE_NAME,
        payload.model_dump_json(),
    )


async def fetch_parse_job(redis_client: redis.Redis) -> Optional[ParseJobPayload]:
    """Blocking pop a parse job from the Redis list."""
    result = await redis_client.brpop(
        settings.REDIS_QUEUE_NAME,
        timeout=settings.WORKER_BRPOP_TIMEOUT,
    )
    if result is None:
        return None
    _, raw = result
    data = json.loads(raw)
    return ParseJobPayload(**data)


async def update_job_status(
    redis_client: redis.Redis,
    job_id: str,
    status: str,
    progress: Optional[float] = None,
    error: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
) -> None:
    """Update the status hash of a job."""
    mapping: Dict[str, str] = {"status": status}
    if progress is not None:
        mapping["progress"] = str(progress)
    if error is not None:
        mapping["error"] = error
    if result is not None:
        mapping["result"] = json.dumps(result, ensure_ascii=False)
    await redis_client.hset(_job_key(job_id), mapping=mapping)


async def get_job_status(
    redis_client: redis.Redis,
    job_id: str,
) -> Optional[ParseStatusResponse]:
    """Retrieve current parse job status."""
    data = await redis_client.hgetall(_job_key(job_id))
    if not data:
        return None
    return ParseStatusResponse(
        job_id=job_id,
        status=data.get("status", "UNKNOWN"),
        progress=_parse_progress(data.get("progress")),
        error=data.get("error") or None,
    )


def _parse_progress(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None

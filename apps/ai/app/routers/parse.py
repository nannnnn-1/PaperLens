"""Parse task submission and status endpoints."""

import uuid

import redis.asyncio as redis
from fastapi import APIRouter, Depends

from app.dependencies import get_redis
from app.schemas import (
    ApiResponse,
    ParseJobPayload,
    ParseRequest,
    ParseResponse,
)
from app.services.redis_client import enqueue_parse_job, get_job_status

router = APIRouter(tags=["parse"])


def _generate_job_id() -> str:
    return f"job_{uuid.uuid4().hex[:16]}"


@router.post("/parse", response_model=ApiResponse)
async def submit_parse(
    req: ParseRequest,
    redis_client: redis.Redis = Depends(get_redis),
) -> ApiResponse:
    """Submit a PDF parsing task to the Redis queue."""
    job_id = _generate_job_id()
    payload = ParseJobPayload(
        job_id=job_id,
        paper_id=req.paper_id,
        file_url=req.file_url,
    )
    await enqueue_parse_job(redis_client, payload)
    return ApiResponse(
        data=ParseResponse(job_id=job_id, status="QUEUED"),
    )


@router.get("/parse/{job_id}", response_model=ApiResponse)
async def get_parse_status(
    job_id: str,
    redis_client: redis.Redis = Depends(get_redis),
) -> ApiResponse:
    """Get the current status of a parse job."""
    status = await get_job_status(redis_client, job_id)
    if status is None:
        return ApiResponse(
            code=404,
            data=None,
            message="Job not found",
        )
    return ApiResponse(data=status)

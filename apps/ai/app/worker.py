"""Background worker: BRPOP Redis queue, parse PDF, callback Nest.js."""

import asyncio
import logging
import os
from typing import Any, Dict, List

import httpx
import openai
import redis.asyncio as redis

from app.config import settings
from app.schemas import ParseJobPayload
from app.services.callback import (
    build_failure_payload,
    build_success_payload,
    notify_parse_complete,
)
from app.services.embedder import Embedder
from app.services.extractor import Extractor
from app.services.http_client import create_http_client
from app.services.llm_client import LLMClient
from app.services.pdf_parser import download_pdf, parse_pdf
from app.services.redis_client import create_redis_client, fetch_parse_job, update_job_status

logger = logging.getLogger(__name__)


def _safe_model_dump(items: List[Any]) -> List[Dict[str, Any]]:
    """Serialize Pydantic models to dict, skipping None values."""
    return [item.model_dump(exclude_none=True) for item in items]


async def process_job(
    redis_client: redis.Redis,
    http_client: httpx.AsyncClient,
    llm: LLMClient,
    job: ParseJobPayload,
) -> None:
    """Download, parse, extract, embed and callback for a single job."""
    job_id = job.job_id
    paper_id = job.paper_id
    file_url = job.file_url

    await update_job_status(redis_client, job_id, "PARSING", progress=0.1)
    tmp_path: str = ""

    try:
        # Download PDF
        tmp_path = await download_pdf(http_client, file_url)
        await update_job_status(redis_client, job_id, "PARSING", progress=0.3)

        # Parse PDF
        parse_result = parse_pdf(tmp_path)
        blocks = parse_result.blocks
        figures = parse_result.figures
        await update_job_status(redis_client, job_id, "PARSING", progress=0.5)

        # LLM extraction
        extractor = Extractor(llm)
        annotations = await extractor.extract_terms(blocks)
        method_cards = await extractor.extract_method_cards(blocks)
        await update_job_status(redis_client, job_id, "PARSING", progress=0.7)

        # Embeddings (may use a different provider from chat LLM)
        embed_key = settings.OPENAI_EMBEDDING_API_KEY or settings.OPENAI_API_KEY or "sk-no-key"
        embed_base = settings.OPENAI_EMBEDDING_BASE_URL or settings.OPENAI_BASE_URL
        openai_client = openai.AsyncOpenAI(
            api_key=embed_key,
            base_url=embed_base,
            timeout=settings.LLM_TIMEOUT,
        )
        embedder = Embedder(openai_client)
        embeddings = await embedder.embed_batch([b.content for b in blocks])
        await update_job_status(redis_client, job_id, "PARSING", progress=0.9)

        # Attach embeddings to blocks for Nest.js DTO compatibility
        for idx, block in enumerate(blocks):
            if idx < len(embeddings):
                block.embedding = embeddings[idx]

        # Build result
        payload = build_success_payload(
            job_id=job_id,
            paper_id=paper_id,
            blocks=_safe_model_dump(blocks),
            annotations=_safe_model_dump(annotations),
            figures=_safe_model_dump(figures),
            method_cards=_safe_model_dump(method_cards),
        )
        await notify_parse_complete(http_client, payload)
        await update_job_status(
            redis_client,
            job_id,
            "PARSED",
            progress=1.0,
            result=payload["result"],
        )
        logger.info("Job completed: %s paper_id=%s", job_id, paper_id)

    except Exception as exc:
        logger.exception("Job failed: %s", job_id)
        error_msg = str(exc) or "Unknown error"
        try:
            payload = build_failure_payload(
                job_id=job_id,
                paper_id=paper_id,
            )
            await notify_parse_complete(http_client, payload)
        except Exception:
            logger.exception("Failed to notify failure for job %s", job_id)
        await update_job_status(
            redis_client,
            job_id,
            "FAILED",
            error=error_msg,
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


async def worker_loop(worker_id: int) -> None:
    """Single worker loop that consumes from Redis and processes jobs."""
    redis_client = create_redis_client()
    http_client = create_http_client()
    llm = LLMClient()

    try:
        logger.info("Worker %d started", worker_id)
        while True:
            try:
                job = await fetch_parse_job(redis_client)
                if job is None:
                    continue
                logger.info(
                    "Worker %d got job %s paper_id=%s",
                    worker_id,
                    job.job_id,
                    job.paper_id,
                )
                await process_job(redis_client, http_client, llm, job)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Worker %d loop error", worker_id)
                await asyncio.sleep(1)
    finally:
        await http_client.aclose()
        await redis_client.close()
        logger.info("Worker %d stopped", worker_id)


async def start_workers(concurrency: int) -> List[asyncio.Task]:
    """Start background worker tasks."""
    tasks: List[asyncio.Task] = []
    for i in range(concurrency):
        task = asyncio.create_task(worker_loop(i + 1), name=f"worker-{i + 1}")
        tasks.append(task)
    return tasks


async def stop_workers(tasks: List[asyncio.Task]) -> None:
    """Cancel and await worker tasks."""
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


async def main() -> None:
    """Standalone entry point for running workers only."""
    tasks = await start_workers(settings.WORKER_CONCURRENCY)
    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        await stop_workers(tasks)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker process interrupted")

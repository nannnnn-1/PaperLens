"""PaperLens AI Service FastAPI application."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator, List

import openai
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import callback, chat, embeddings, parse, terms, translate
from app.schemas import ApiResponse
from app.services.http_client import create_http_client
from app.services.llm_client import LLMClient
from app.worker import start_workers, stop_workers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

worker_tasks: List[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize shared clients and start background workers."""
    global worker_tasks

    app.state.http_client = create_http_client()
    app.state.openai_client = openai.AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY or "sk-no-key",
        base_url=settings.OPENAI_BASE_URL,
        timeout=settings.LLM_TIMEOUT,
    )
    app.state.llm_client = LLMClient()

    # Separate embedding client (allows different provider from chat LLM)
    embed_key = settings.OPENAI_EMBEDDING_API_KEY or settings.OPENAI_API_KEY or "sk-no-key"
    embed_base = settings.OPENAI_EMBEDDING_BASE_URL or settings.OPENAI_BASE_URL
    app.state.embedding_client = openai.AsyncOpenAI(
        api_key=embed_key,
        base_url=embed_base,
        timeout=settings.LLM_TIMEOUT,
    )

    if settings.WORKER_ENABLED:
        worker_tasks = await start_workers(settings.WORKER_CONCURRENCY)

    yield

    if worker_tasks:
        await stop_workers(worker_tasks)
    await app.state.http_client.aclose()
    await app.state.openai_client.close()
    await app.state.embedding_client.close()


app = FastAPI(
    title="PaperLens AI Service",
    description="PDF parsing, LLM agents, embeddings",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Return 400 with unified envelope for validation errors."""
    return JSONResponse(
        status_code=400,
        content=ApiResponse(
            code=400,
            data={"detail": exc.errors()},
            message="Request validation failed",
        ).model_dump(by_alias=True),
    )


@app.exception_handler(openai.APIStatusError)
async def openai_status_exception_handler(
    request: Request,
    exc: openai.APIStatusError,
) -> JSONResponse:
    """Map OpenAI HTTP errors to unified envelope."""
    status_code = getattr(exc, "status_code", 503)
    code = 429 if status_code == 429 else 503
    return JSONResponse(
        status_code=code,
        content=ApiResponse(
            code=code,
            data=None,
            message=f"LLM provider error: {exc.message}",
        ).model_dump(by_alias=True),
    )


@app.exception_handler(openai.APIConnectionError)
async def openai_connection_exception_handler(
    request: Request,
    exc: openai.APIConnectionError,
) -> JSONResponse:
    """Map OpenAI connection errors to 503."""
    return JSONResponse(
        status_code=503,
        content=ApiResponse(
            code=503,
            data=None,
            message="LLM provider connection failed",
        ).model_dump(by_alias=True),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all to always return unified envelope."""
    logging.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content=ApiResponse(
            code=500,
            data=None,
            message="Internal server error",
        ).model_dump(by_alias=True),
    )


app.include_router(parse.router, prefix="/api/v1")
app.include_router(callback.router, prefix="/api/v1")
app.include_router(translate.router, prefix="/api/v1")
app.include_router(terms.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(embeddings.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}

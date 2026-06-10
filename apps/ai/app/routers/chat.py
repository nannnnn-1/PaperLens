"""General chat endpoint with optional SSE streaming."""

from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.schemas import ApiResponse, ChatMessage, ChatRequest, ChatResponse
from app.services.llm_client import LLMClient

router = APIRouter(tags=["chat"])


def _get_llm(request: Request) -> LLMClient:
    return request.app.state.llm_client


def _to_dict(messages: list[ChatMessage]) -> list[dict[str, str]]:
    return [{"role": m.role, "content": m.content} for m in messages]


async def _sse_stream(
    llm: LLMClient,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int | None,
) -> AsyncIterator[str]:
    """Yield SSE formatted chunks matching PaperLens event contract."""
    async for chunk in llm.chat_stream(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    ):
        yield f"event: chat:delta\ndata: {chunk}\n\n"
    yield "event: chat:done\ndata: finish\n\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    llm: LLMClient = Depends(_get_llm),
):
    """General chat endpoint. Returns SSE stream when stream=true."""
    messages = _to_dict(req.messages)

    if req.stream:
        return StreamingResponse(
            _sse_stream(
                llm,
                messages,
                temperature=req.temperature or 0.7,
                max_tokens=req.max_tokens,
            ),
            media_type="text/event-stream",
        )

    content = await llm.chat(
        messages=messages,
        temperature=req.temperature or 0.7,
        max_tokens=req.max_tokens,
    )
    return ApiResponse(
        data=ChatResponse(reply=content, finish=True),
    )

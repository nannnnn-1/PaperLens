from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: bool = False


@router.post("/chat")
async def chat(req: ChatRequest):
    """通用对话接口"""
    # TODO: 调用 LLM API
    return {"reply": "TODO: implement chat", "finish": True}

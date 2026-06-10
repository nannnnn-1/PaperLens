"""Translation endpoint for semantic blocks."""

from fastapi import APIRouter, Depends, Request

from app.schemas import ApiResponse, TranslateRequest, TranslateResponse
from app.services.llm_client import LLMClient
from app.services.translator import Translator

router = APIRouter(tags=["translate"])


def _get_llm(request: Request) -> LLMClient:
    return request.app.state.llm_client


@router.post("/translate", response_model=ApiResponse)
async def translate(
    req: TranslateRequest,
    llm: LLMClient = Depends(_get_llm),
) -> ApiResponse:
    """Translate a batch of semantic blocks."""
    translator = Translator(llm)
    translations = await translator.translate_blocks(
        req.blocks,
        req.target_lang,
    )
    return ApiResponse(
        data=TranslateResponse(translations=translations),
    )

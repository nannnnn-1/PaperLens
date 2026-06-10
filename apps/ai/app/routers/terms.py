"""Term extraction endpoint."""

from fastapi import APIRouter, Depends, Request

from app.schemas import (
    ApiResponse,
    TermsExtractRequest,
    TermsExtractResponse,
)
from app.services.llm_client import LLMClient

router = APIRouter(tags=["terms"])

TERMS_SYSTEM_PROMPT = """You are a computer science paper analysis assistant.
Extract key technical terms from the provided academic text.
For each term, provide a concise definition and classify it into one of:
ALGORITHM, CONCEPT, DATASET_METRIC, CITATION, CODE_TOOL.

Respond ONLY with a JSON object in this exact format:
{
  "terms": [
    {"term": "...", "definition": "...", "category": "CONCEPT"}
  ]
}
"""


def _get_llm(request: Request) -> LLMClient:
    return request.app.state.llm_client


@router.post("/terms/extract", response_model=ApiResponse)
async def extract_terms(
    req: TermsExtractRequest,
    llm: LLMClient = Depends(_get_llm),
) -> ApiResponse:
    """Extract terms with definitions from a text snippet."""
    user_content = req.text
    if req.context:
        user_content = f"Context: {req.context}\n\nText: {req.text}"

    messages = [
        {"role": "system", "content": TERMS_SYSTEM_PROMPT},
        {"role": "user", "content": user_content[:12000]},
    ]
    data = await llm.extract_json(messages, temperature=0.2)
    raw_terms = data.get("terms", [])

    from app.schemas import AnnotationType, TermItem

    terms = []
    for item in raw_terms:
        try:
            category = item.get("category", "CONCEPT")
            terms.append(
                TermItem(
                    term=item.get("term", ""),
                    definition=item.get("definition", ""),
                    category=AnnotationType(category),
                )
            )
        except Exception:
            continue

    return ApiResponse(data=TermsExtractResponse(terms=terms))

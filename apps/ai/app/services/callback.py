"""HTTP callback to Nest.js with parse results."""

from typing import Any, Dict, List

import httpx

from app.config import settings


def _callback_url() -> str:
    return f"{settings.NEST_API_URL.rstrip('/')}{settings.NEST_CALLBACK_PATH}"


async def notify_parse_complete(
    http_client: httpx.AsyncClient,
    payload: Dict[str, Any],
) -> None:
    """POST parse result to the Nest.js callback endpoint."""
    url = _callback_url()
    resp = await http_client.post(url, json=payload)
    resp.raise_for_status()


def build_success_payload(
    job_id: str,
    paper_id: str,
    blocks: List[Dict[str, Any]],
    annotations: List[Dict[str, Any]],
    figures: List[Dict[str, Any]],
    method_cards: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build success callback payload matching Nest.js DTO."""
    return {
        "jobId": job_id,
        "paperId": paper_id,
        "result": {
            "blocks": blocks,
            "annotations": annotations,
            "figures": figures,
            "methodCards": method_cards,
        },
    }


def build_failure_payload(
    job_id: str,
    paper_id: str,
) -> Dict[str, Any]:
    """Build failure callback payload that passes Nest.js validation.

    Nest.js ParseCallbackDto requires result.blocks to be a non-empty array
    or an empty array (which sets parseStatus=PARSED). There is no native
    failure callback support yet, so we send an empty result to avoid 400.
    """
    return {
        "jobId": job_id,
        "paperId": paper_id,
        "result": {
            "blocks": [],
            "annotations": [],
            "figures": [],
            "methodCards": [],
        },
    }

"""HTTP callback to Nest.js with parse results."""

from typing import Any, Dict

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


def build_callback_payload(
    job_id: str,
    paper_id: str,
    status: str,
    result: Dict[str, Any],
    error: str = "",
) -> Dict[str, Any]:
    """Build the payload for Nest.js parse callback."""
    return {
        "job_id": job_id,
        "paper_id": paper_id,
        "status": status,
        "result": result,
        "error": error,
    }

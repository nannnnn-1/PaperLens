"""Shared HTTP client with timeout and retry configuration."""

import httpx

from app.config import settings


def create_http_client() -> httpx.AsyncClient:
    """Create a shared async HTTP client."""
    limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
    timeout = httpx.Timeout(
        settings.PDF_DOWNLOAD_TIMEOUT,
        connect=10.0,
    )
    return httpx.AsyncClient(limits=limits, timeout=timeout)

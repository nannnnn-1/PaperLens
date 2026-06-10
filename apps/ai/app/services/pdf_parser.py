"""PDF parsing with PyMuPDF: text blocks, headings, figures."""

import os
import re
import tempfile
from typing import List

import fitz
import httpx

from app.config import settings
from app.schemas import BBox, Figure, SemanticBlock


def _is_heading(block: dict, page_height: float) -> bool:
    """Heuristic heading detection based on font size and flags."""
    spans = block.get("lines", [])
    if not spans:
        return False
    for line in spans:
        for span in line.get("spans", []):
            size = span.get("size", 11)
            flags = span.get("flags", 0)
            if size >= 14 or (size >= 12 and flags & 2 ** 4):
                return True
    return False


def _block_bbox(block: dict) -> BBox:
    """Convert PyMuPDF bbox to schema BBox."""
    rect = block.get("bbox", [0, 0, 0, 0])
    return BBox(
        x=round(rect[0], 2),
        y=round(rect[1], 2),
        w=round(rect[2] - rect[0], 2),
        h=round(rect[3] - rect[1], 2),
    )


def _normalize_text(text: str) -> str:
    """Clean extracted PDF text."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class PDFParseResult:
    """Container for PDF parsing outputs."""

    def __init__(
        self,
        blocks: List[SemanticBlock],
        figures: List[Figure],
    ) -> None:
        self.blocks = blocks
        self.figures = figures


async def download_pdf(http_client: httpx.AsyncClient, file_url: str) -> str:
    """Download a PDF to a temporary file and return its path.

    Supports http/https URLs via httpx, and file:// URLs via local copy.
    """
    if file_url.startswith("file://"):
        from urllib.parse import urlparse
        parsed = urlparse(file_url)
        local_path = parsed.path
        # On Windows, urlparse leaves a leading slash on absolute paths
        if local_path.startswith("/") and len(local_path) > 2 and local_path[2] == ":":
            local_path = local_path[1:]
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local PDF not found: {local_path}")
        return local_path

    resp = await http_client.get(file_url)
    resp.raise_for_status()
    content_length = len(resp.content)
    max_bytes = settings.MAX_PDF_SIZE_MB * 1024 * 1024
    if content_length > max_bytes:
        raise ValueError(
            f"PDF size {content_length} exceeds limit "
            f"{settings.MAX_PDF_SIZE_MB}MB"
        )

    suffix = os.path.splitext(file_url.split("?")[0].split("/")[-1])[1]
    if suffix.lower() != ".pdf":
        suffix = ".pdf"

    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(resp.content)
    except Exception:
        os.unlink(tmp_path)
        raise
    return tmp_path


def parse_pdf(file_path: str) -> PDFParseResult:
    """Parse a local PDF file into semantic blocks and figure metadata."""
    doc = fitz.open(file_path)
    try:
        if len(doc) > settings.MAX_PDF_PAGES:
            doc.close()
            raise ValueError(
                f"PDF has {len(doc)} pages, max allowed is "
                f"{settings.MAX_PDF_PAGES}"
            )

        blocks: List[SemanticBlock] = []
        figures: List[Figure] = []
        block_index = 0
        figure_index = 0

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            page_height = page.rect.height
            page_blocks = page.get_text("dict")["blocks"]

            for raw in page_blocks:
                btype = raw.get("type")
                if btype != 0:
                    # Skip image blocks for now; figure captions handled below
                    continue

                text = _normalize_text(
                    "".join(
                        span["text"]
                        for line in raw.get("lines", [])
                        for span in line.get("spans", [])
                    )
                )
                if not text or len(text) < 2:
                    continue

                is_heading = _is_heading(raw, page_height)
                block_type = "HEADING" if is_heading else "PARAGRAPH"
                level = 1 if is_heading else None

                blocks.append(
                    SemanticBlock(
                        block_index=block_index,
                        block_type=block_type,
                        level=level,
                        content=text,
                        page_number=page_num + 1,
                        bbox=_block_bbox(raw),
                    )
                )
                block_index += 1

                # Heuristic figure caption detection
                lowered = text.lower()
                if lowered.startswith("figure ") or lowered.startswith("fig."):
                    figure_index += 1
                    figures.append(
                        Figure(
                            figure_index=figure_index,
                            caption=text,
                            page_number=page_num + 1,
                            bbox=_block_bbox(raw),
                        )
                    )

        return PDFParseResult(blocks=blocks, figures=figures)
    finally:
        doc.close()


def extract_text_for_llm(blocks: List[SemanticBlock]) -> str:
    """Serialize blocks into a string suitable for LLM prompts."""
    lines: List[str] = []
    for b in blocks:
        prefix = "# " if b.block_type == "HEADING" else ""
        lines.append(f"{prefix}{b.content}")
    return "\n\n".join(lines)

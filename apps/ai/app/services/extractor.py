"""LLM-based extraction of terms and method cards from paper text."""

from typing import List

from app.schemas import Annotation, AnnotationType, Dataset, EvidenceItem
from app.schemas import MethodCard, Metric, SemanticBlock
from app.services.llm_client import LLMClient

TERMS_SYSTEM_PROMPT = """You are a computer science paper analysis assistant.
Extract key technical terms from the provided academic paper text.
For each term, provide a concise definition and classify it into one of:
ALGORITHM, CONCEPT, DATASET_METRIC, CITATION, CODE_TOOL.

Respond ONLY with a JSON object in this exact format:
{
  "terms": [
    {"term": "...", "definition": "...", "category": "ALGORITHM"}
  ]
}
"""

METHOD_CARDS_SYSTEM_PROMPT = """You are a computer science paper analysis assistant.
Extract method cards from the provided academic paper text.
A method card describes an approach/model with: name, backbone, datasets,
metrics (name/value/unit), parameter count, and whether code is available.

Respond ONLY with a JSON object in this exact format:
{
  "method_cards": [
    {
      "name": "...",
      "category": "...",
      "backbone": "...",
      "datasets": [{"name": "...", "splits": "..."}],
      "metrics": [{"name": "...", "value": "...", "unit": "..."}],
      "params_count": "...",
      "is_code_available": false,
      "code_url": ""
    }
  ]
}
"""


def _first_block_evidence(blocks: List[SemanticBlock]) -> EvidenceItem:
    return EvidenceItem(
        type="TEXT",
        block_id=str(blocks[0].block_index) if blocks else None,
        excerpt=blocks[0].content[:200] if blocks else "",
    )


class Extractor:
    """Extract structured paper metadata using LLM."""

    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    async def extract_terms(
        self,
        blocks: List[SemanticBlock],
    ) -> List[Annotation]:
        """Extract terms as Annotations."""
        text = self._blocks_to_text(blocks)
        messages = [
            {"role": "system", "content": TERMS_SYSTEM_PROMPT},
            {"role": "user", "content": f"Paper text:\n{text[:12000]}"},
        ]
        try:
            data = await self.llm.extract_json(messages, temperature=0.2)
        except Exception:
            return []
        items = data.get("terms", [])
        annotations: List[Annotation] = []
        for item in items:
            try:
                category_str = item.get("category", "CONCEPT")
                annotations.append(
                    Annotation(
                        type=AnnotationType(category_str),
                        text=item.get("term", ""),
                        label=item.get("term", ""),
                        definition=item.get("definition", ""),
                        evidence=[_first_block_evidence(blocks)],
                    )
                )
            except Exception:
                continue
        return annotations

    async def extract_method_cards(
        self,
        blocks: List[SemanticBlock],
    ) -> List[MethodCard]:
        """Extract method cards."""
        text = self._blocks_to_text(blocks)
        messages = [
            {"role": "system", "content": METHOD_CARDS_SYSTEM_PROMPT},
            {"role": "user", "content": f"Paper text:\n{text[:12000]}"},
        ]
        try:
            data = await self.llm.extract_json(messages, temperature=0.2)
        except Exception:
            return []
        items = data.get("method_cards", [])
        cards: List[MethodCard] = []
        for item in items:
            try:
                datasets = [
                    Dataset(name=d.get("name", ""), splits=d.get("splits"))
                    for d in item.get("datasets", [])
                    if d.get("name")
                ]
                metrics = [
                    Metric(
                        name=m.get("name", ""),
                        value=str(m.get("value", "")),
                        unit=m.get("unit"),
                    )
                    for m in item.get("metrics", [])
                    if m.get("name")
                ]
                cards.append(
                    MethodCard(
                        name=item.get("name", ""),
                        category=item.get("category"),
                        backbone=item.get("backbone"),
                        datasets=datasets,
                        metrics=metrics,
                        params_count=item.get("params_count"),
                        is_code_available=item.get("is_code_available"),
                        code_url=item.get("code_url") or None,
                        evidence=[_first_block_evidence(blocks)],
                    )
                )
            except Exception:
                continue
        return cards

    def _blocks_to_text(self, blocks: List[SemanticBlock]) -> str:
        lines: List[str] = []
        for b in blocks:
            prefix = "# " if b.block_type == "HEADING" else ""
            lines.append(f"{prefix}{b.content}")
        return "\n\n".join(lines)

"""Translation service for semantic blocks."""

from typing import List

from app.schemas import SemanticBlock
from app.services.llm_client import LLMClient

TRANSLATE_SYSTEM_PROMPT = """You are a professional academic paper translator.
Translate the following paper segments into the target language accurately,
preserving technical terms in the original language where appropriate.

Respond ONLY with a JSON object in this exact format:
{
  "translations": ["translated segment 1", "translated segment 2", ...]
}
The length and order of translations must exactly match the input segments.
"""


class Translator:
    """Translate semantic blocks using LLM."""

    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    async def translate_blocks(
        self,
        blocks: List[SemanticBlock],
        target_lang: str,
    ) -> List[SemanticBlock]:
        """Translate a list of blocks into the target language."""
        if not blocks:
            return []

        inputs = [b.content for b in blocks]
        user_prompt = (
            f"Target language: {target_lang}\n\n"
            f"Segments:\n" + "\n---\n".join(inputs)
        )
        messages = [
            {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        try:
            data = await self.llm.extract_json(messages, temperature=0.3)
        except Exception:
            # On failure return originals without translation
            return blocks

        translations = data.get("translations", [])
        result: List[SemanticBlock] = []
        for idx, block in enumerate(blocks):
            translated = translations[idx] if idx < len(translations) else None
            result.append(
                SemanticBlock(
                    block_index=block.block_index,
                    block_type=block.block_type,
                    level=block.level,
                    content=block.content,
                    translation=translated,
                    page_number=block.page_number,
                    bbox=block.bbox,
                )
            )
        return result

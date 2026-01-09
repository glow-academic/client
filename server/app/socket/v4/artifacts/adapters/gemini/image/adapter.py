"""Gemini image generation adapter - stub implementation."""

import uuid
from typing import Any

from ....base.types import ImageGenerationResult
from ....base.output_adapter import BaseOutputAdapter


class GeminiImageAdapter(BaseOutputAdapter):
    """Gemini image generation adapter - not yet implemented."""

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> ImageGenerationResult:
        """Generate image using Gemini - not yet implemented."""
        raise NotImplementedError("Gemini image adapter not yet implemented")

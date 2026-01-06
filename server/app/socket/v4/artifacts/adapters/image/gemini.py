"""Gemini image generation adapter - stub implementation."""

import uuid
from typing import Any

from ..base import ImageGenerationResult
from .base import BaseImageAdapter


class GeminiImageAdapter(BaseImageAdapter):
    """Gemini image generation adapter - not yet implemented."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> ImageGenerationResult:
        """Generate image using Gemini - not yet implemented."""
        raise NotImplementedError("Gemini image adapter not yet implemented")


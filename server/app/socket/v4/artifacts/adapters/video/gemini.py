"""Gemini video generation adapter - stub implementation."""

import uuid
from typing import Any

from ..base import VideoGenerationResult
from .base import BaseVideoAdapter


class GeminiVideoAdapter(BaseVideoAdapter):
    """Gemini video generation adapter - not yet implemented."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> VideoGenerationResult:
        """Generate video using Gemini - not yet implemented."""
        raise NotImplementedError("Gemini video adapter not yet implemented")


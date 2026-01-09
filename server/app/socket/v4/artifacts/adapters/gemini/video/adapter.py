"""Gemini video generation adapter - stub implementation."""

import uuid
from typing import Any

from ....base.types import VideoGenerationResult
from ....base.output_adapter import BaseOutputAdapter


class GeminiVideoAdapter(BaseOutputAdapter):
    """Gemini video generation adapter - not yet implemented."""

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> VideoGenerationResult:
        """Generate video using Gemini - not yet implemented."""
        raise NotImplementedError("Gemini video adapter not yet implemented")

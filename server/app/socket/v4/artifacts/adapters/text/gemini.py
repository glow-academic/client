"""Gemini text generation adapter - stub implementation."""

import uuid
from typing import Any

from .base import BaseTextAdapter


class GeminiTextAdapter(BaseTextAdapter):
    """Gemini text generation adapter - not yet implemented."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> None:
        """Generate text using Gemini agent - not yet implemented."""
        raise NotImplementedError("Gemini text adapter not yet implemented")


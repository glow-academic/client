"""Gemini text generation adapter - stub implementation."""

import uuid
from typing import Any

from ....base.output_adapter import BaseOutputAdapter


class GeminiTextAdapter(BaseOutputAdapter):
    """Gemini text generation adapter - not yet implemented."""

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> None:
        """Generate text using Gemini agent - not yet implemented."""
        raise NotImplementedError("Gemini text adapter not yet implemented")

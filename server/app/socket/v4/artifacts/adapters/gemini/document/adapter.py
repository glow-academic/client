"""Gemini document generation adapter - stub implementation."""

import uuid
from typing import Any

from ....base.types import DocumentGenerationResult
from ....base.output_adapter import BaseOutputAdapter


class GeminiDocumentAdapter(BaseOutputAdapter):
    """Gemini document generation adapter - not yet implemented."""

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> DocumentGenerationResult:
        """Generate document using Gemini - not yet implemented."""
        raise NotImplementedError("Gemini document adapter not yet implemented")

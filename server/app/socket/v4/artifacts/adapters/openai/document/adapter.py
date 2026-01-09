"""OpenAI document generation adapter - handles document generation."""

import uuid
from typing import Any

from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest

from ....base.types import DocumentGenerationResult
from ....base.output_adapter import BaseOutputAdapter

internal_sio = get_internal_sio()


class OpenAIDocumentAdapter(BaseOutputAdapter):
    """OpenAI document generation adapter."""

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> DocumentGenerationResult:
        """Generate document using OpenAI agent.

        Args:
            sid: Socket ID
            data: Request data containing document_id, agent_id, etc.
            profile_id: Profile ID
            conn: Database connection

        Returns:
            DocumentGenerationResult with document_id, html_content, file_path
        """
        # Document generation uses text adapter with special formatting
        # For now, raise NotImplementedError - will be implemented when document generation is needed
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message="OpenAI document adapter not yet implemented",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )
        raise NotImplementedError("OpenAI document adapter not yet implemented")

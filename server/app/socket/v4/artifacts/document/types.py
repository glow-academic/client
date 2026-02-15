"""WebSocket-specific types for document generation.

Extends base artifact types with document-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.document.types import GetDocumentApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Client-to-Server Events (document_generate)
# =============================================================================


class GenerateDocumentPayload(GetDocumentApiRequest):
    """Request payload for document_generate WebSocket event.

    Extends GetDocumentApiRequest (which has document_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - resource_types API (gold standard pattern)
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


# =============================================================================
# Server-to-Client Events
# =============================================================================


class DocumentGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: document_generation_complete.

    Emitted when document generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "document"


class DocumentGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: document_generation_progress.

    Emitted during document resource generation to show progress.
    """

    artifact_type: str = "document"


class DocumentGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: document_generation_error.

    Emitted when document resource generation fails.
    """

    artifact_type: str = "document"

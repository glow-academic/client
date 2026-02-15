"""WebSocket-specific types for tool generation.

Extends base artifact types with tool-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.tool.types import GetToolApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Client-to-Server Events (tool_generate)
# =============================================================================


class GenerateToolPayload(GetToolApiRequest):
    """Request payload for tool_generate WebSocket event.

    Extends GetToolApiRequest (which has tool_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - resource-type-based API
    resource_types: list[str]
    user_instructions: list[str] | None = None  # Optional: user instructions


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ToolGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: tool_generation_complete.

    Emitted when tool generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "tool"


class ToolGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: tool_generation_progress.

    Emitted during tool resource generation to show progress.
    """

    artifact_type: str = "tool"


class ToolGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: tool_generation_error.

    Emitted when tool resource generation fails.
    """

    artifact_type: str = "tool"

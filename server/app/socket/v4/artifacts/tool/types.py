"""WebSocket-specific types for tool generation.

Extends base artifact types with tool-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.tool.types import GetToolApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
)

# =============================================================================
# Client-to-Server Events (tool_generate)
# =============================================================================


class GenerateToolPayload(GetToolApiRequest):
    """Request payload for tool_generate WebSocket event.

    Extends GetToolApiRequest (which has tool_id, draft_id)
    with generation-specific fields and form state.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[
        UUID
    ]  # Required: which domains to generate (client passes these through)
    user_instructions: list[str] | None = None  # Optional: user instructions


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ToolGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: tool_generation_complete.

    Emitted when a tool resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "tool"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    args_resources: list[QGetArgsV4Item] | None = None
    args_outputs_resources: list[QGetArgsOutputsV4Item] | None = None


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

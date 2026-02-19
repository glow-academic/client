"""WebSocket-specific types for rubric generation.

Extends base artifact types with rubric-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.rubric.types import GetRubricApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

RUBRIC_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "departments",
    "flags",
    "points",
    "pass_points",
    "standard_groups",
    "standards",
]

RUBRIC_SYNC_ENTRY_TYPES = ["runs"]

RUBRIC_ASYNC_ENTRY_TYPES = ["debug_info"]

# =============================================================================
# Client-to-Server Events (rubric_generate)
# =============================================================================


class GenerateRubricPayload(GetRubricApiRequest):
    """Request payload for rubric_generate WebSocket event.

    Extends GetRubricApiRequest (which has rubric_id, draft_id, search terms)
    with generation-specific fields.
    """

    # Generation-specific fields - resource-based API
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class RubricGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: rubric_generation_complete.

    Emitted when rubric generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "rubric"
    rubric_id: str | None = None


class RubricGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: rubric_generation_progress.

    Emitted during rubric resource generation to show progress.
    """

    artifact_type: str = "rubric"


class RubricGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: rubric_generation_error.

    Emitted when rubric resource generation fails.
    """

    artifact_type: str = "rubric"

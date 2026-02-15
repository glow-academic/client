"""WebSocket-specific types for model generation.

Extends base artifact types with model-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.model.types import GetModelApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Client-to-Server Events (model_generate)
# =============================================================================


class GenerateModelPayload(GetModelApiRequest):
    """Request payload for model_generate WebSocket event.

    Extends GetModelApiRequest (which has model_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - resource-type-based API
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ModelGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: model_generation_complete.

    Emitted when model generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "model"


class ModelGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: model_generation_progress.

    Emitted during model resource generation to show progress.
    """

    artifact_type: str = "model"


class ModelGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: model_generation_error.

    Emitted when model resource generation fails.
    """

    artifact_type: str = "model"

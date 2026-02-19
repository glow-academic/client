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
# Generation type constants
# =============================================================================

MODEL_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "values",
    "providers",
    "flags",
    "departments",
    "modalities",
    "temperature_levels",
    "pricing",
    "reasoning_levels",
    "qualities",
    "voices",
]

MODEL_SYNC_ENTRY_TYPES = ["runs"]

MODEL_ASYNC_ENTRY_TYPES = ["debug_info"]

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
    save: bool = True  # Whether to auto-save on completion


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ModelGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: model_generation_complete.

    Emitted when model generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "model"
    model_id: str | None = None


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

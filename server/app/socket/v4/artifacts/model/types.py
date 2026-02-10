"""WebSocket-specific types for model generation.

Extends base artifact types with model-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.model.types import GetModelApiRequest, ModelFlagConfig
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetModalitiesV4Item,
    QGetNamesV4Item,
    QGetPricingV4Item,
    QGetQualitiesV4Item,
    QGetReasoningLevelsV4Item,
    QGetTemperatureLevelsV4Item,
    QGetValuesV4Item,
    QGetVoicesV4Item,
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

    Emitted when a model resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "model"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    value_resource: QGetValuesV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    flag_resources: list[ModelFlagConfig] | None = None
    department_resources: list[QGetDepartmentsV4Item] | None = None
    modality_resources: list[QGetModalitiesV4Item] | None = None
    temperature_level_resources: list[QGetTemperatureLevelsV4Item] | None = None
    pricing_resources: list[QGetPricingV4Item] | None = None
    reasoning_level_resources: list[QGetReasoningLevelsV4Item] | None = None
    quality_resources: list[QGetQualitiesV4Item] | None = None
    voice_resources: list[QGetVoicesV4Item] | None = None


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

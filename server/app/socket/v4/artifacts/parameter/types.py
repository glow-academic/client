"""WebSocket-specific types for parameter generation.

Extends base artifact types with parameter-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
)

# =============================================================================
# Client-to-Server Events (parameter_generate)
# =============================================================================


class GenerateParameterPayload(BaseModel):
    """Request payload for parameter_generate WebSocket event."""

    artifact_type: str = "parameter"
    parameter_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ParameterGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: parameter_generation_complete.

    Emitted when a parameter resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "parameter"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    field_resources: list[QGetParameterFieldsV4Item] | None = None


class ParameterGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: parameter_generation_progress.

    Emitted during parameter resource generation to show progress.
    """

    artifact_type: str = "parameter"


class ParameterGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: parameter_generation_error.

    Emitted when parameter resource generation fails.
    """

    artifact_type: str = "parameter"

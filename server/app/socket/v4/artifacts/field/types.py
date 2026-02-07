"""WebSocket-specific types for field generation.

Extends base artifact types with field-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.field.types import GetFieldApiRequest
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
    QGetParametersV4Item,
)

# =============================================================================
# Client-to-Server Events (field_generate)
# =============================================================================


class GenerateFieldPayload(GetFieldApiRequest):
    """Request payload for field_generate WebSocket event.

    Extends GetFieldApiRequest (which has field_id, draft_id, search terms)
    with generation-specific fields and current form state.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[UUID]  # Required: which domains to generate
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Current form state (for context in generation)
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class FieldGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: field_generation_complete.

    Emitted when a field resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "field"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    parameter_resources: list[QGetParametersV4Item] | None = None


class FieldGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: field_generation_progress.

    Emitted during field resource generation to show progress.
    """

    artifact_type: str = "field"


class FieldGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: field_generation_error.

    Emitted when field resource generation fails.
    """

    artifact_type: str = "field"

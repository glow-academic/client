"""WebSocket-specific types for parameter generation.

Extends base artifact types with parameter-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.parameter.types import GetParameterApiRequest
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


class GenerateParameterPayload(GetParameterApiRequest):
    """Request payload for parameter_generate WebSocket event.

    Extends GetParameterApiRequest (which has parameter_id, draft_id, search terms)
    with generation-specific fields and form state.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[
        UUID
    ]  # Required: which domains to generate (client passes these through)
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Note: current selections are derived from draft-backed API response.
    # The server looks up agent_ids and group_ids from the domains mapping in get_parameter_internal().


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

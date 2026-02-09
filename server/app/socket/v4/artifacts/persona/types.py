"""WebSocket-specific types for persona generation.

Extends base artifact types with persona-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.persona.types import GetPersonaApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetExamplesV4Item,
    QGetFlagsV4Item,
    QGetIconsV4Item,
    QGetInstructionsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
)

# =============================================================================
# Client-to-Server Events (persona_generate)
# =============================================================================


class GeneratePersonaPayload(GetPersonaApiRequest):
    """Request payload for persona_generate WebSocket event.

    Extends GetPersonaApiRequest (which has persona_id, draft_id, search terms)
    with generation-specific fields and form state.
    """

    # Generation-specific fields - resource-type-based API
    resource_types: list[
        str
    ]  # Required: which resource types to generate (e.g. ["names", "descriptions"])
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Note: current selections are derived from draft-backed API response.
    # The server resolves domain_ids and agent_ids internally from the resource_types.


# =============================================================================
# Server-to-Client Events
# =============================================================================


class PersonaGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: persona_generation_complete.

    Emitted when a persona resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "persona"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    color_resource: QGetColorsV4Item | None = None
    icon_resource: QGetIconsV4Item | None = None
    instructions_resource: QGetInstructionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    parameter_field_resources: list[QGetParameterFieldsV4Item] | None = None
    example_resources: list[QGetExamplesV4Item] | None = None
    parameter_resources: list[QGetParametersV4Item] | None = None


class PersonaGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: persona_generation_progress.

    Emitted during persona resource generation to show progress.
    """

    artifact_type: str = "persona"


class PersonaGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: persona_generation_error.

    Emitted when persona resource generation fails.
    """

    artifact_type: str = "persona"

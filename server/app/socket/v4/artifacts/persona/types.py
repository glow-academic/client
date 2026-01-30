"""WebSocket-specific types for persona generation.

Extends API types with fields only needed for WebSocket events.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.persona.types import GetPersonaApiRequest
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

    # Generation-specific fields
    agent_id: UUID  # Required: explicit agent ID from frontend
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Form state fields for "current" variable in Jinja templates
    # These represent the currently selected resources in the form
    name_id: UUID | None = None
    description_id: UUID | None = None
    color_id: UUID | None = None
    icon_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class PersonaGenerationCompleteEvent(BaseModel):
    """Server-to-client event: persona_generation_complete.

    Emitted when a persona resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "persona"
    group_id: str
    resource_type: str
    run_id: str | None = None
    success: bool
    message: str

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


class PersonaGenerationProgressEvent(BaseModel):
    """Server-to-client event: persona_generation_progress.

    Emitted during persona resource generation to show progress.
    """

    artifact_type: str = "persona"
    group_id: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    run_id: str | None = None
    modality: str | None = None
    type: str | None = None  # "start", "progress"
    event_type: str | None = None  # "tool_call_start", "tool_call_delta", etc.
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments: dict | None = None
    arguments_delta: str | None = None
    trace_id: str | None = None


class PersonaGenerationErrorEvent(BaseModel):
    """Server-to-client event: persona_generation_error.

    Emitted when persona resource generation fails.
    """

    artifact_type: str = "persona"
    group_id: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    success: bool = False
    message: str
    trace_id: str | None = None

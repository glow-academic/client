"""WebSocket-specific types for persona generation.

Extends API types with fields only needed for WebSocket events.
"""

from uuid import UUID

from app.api.v4.artifacts.persona.types import GetPersonaApiRequest


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

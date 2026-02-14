"""WebSocket-specific types for persona generation.

Extends base artifact types with persona-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.persona.types import GetPersonaApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
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
    save: bool = True  # Whether to auto-save persona on completion

    # Note: current selections are derived from draft-backed API response.
    # The server resolves assigned agents internally from resource_types.


# =============================================================================
# Server-to-Client Events
# =============================================================================


class PersonaGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: persona_generation_complete.

    Emitted when all agents have finished generating persona resources.
    Contains optional persona_id if auto-save succeeded.
    Resource-level data is now sent via resource_generation_complete events.
    """

    artifact_type: str = "persona"
    persona_id: str | None = None


class PersonaGenerationProgressEvent(BaseModel):
    """Server-to-client event: persona_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "persona"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class PersonaGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: persona_generation_error.

    Emitted when persona resource generation fails.
    """

    artifact_type: str = "persona"

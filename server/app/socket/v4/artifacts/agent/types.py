"""WebSocket-specific types for agent generation.

Extends base artifact types with agent-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.agent.types import GetAgentApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetInstructionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetPromptsV4Item,
    QGetReasoningLevelsV4Item,
    QGetTemperatureLevelsV4Item,
    QGetToolsV4Item,
    QGetVoicesV4Item,
)

# =============================================================================
# Client-to-Server Events (agent_generate)
# =============================================================================


class GenerateAgentPayload(GetAgentApiRequest):
    """Request payload for agent_generate WebSocket event.

    Extends GetAgentApiRequest (which has agent_id, draft_id)
    with generation-specific fields. Uses domain_ids instead of agent_type.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[UUID]  # Required: which domains to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


# =============================================================================
# Server-to-Client Events
# =============================================================================


class AgentGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: agent_generation_complete.

    Emitted when an agent resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "agent"

    # Single-select resources (full objects)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    model_resource: QGetModelsV4Item | None = None
    prompt_resource: QGetPromptsV4Item | None = None
    instructions_resource: QGetInstructionsV4Item | None = None
    temperature_level_resource: QGetTemperatureLevelsV4Item | None = None
    reasoning_level_resource: QGetReasoningLevelsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    tool_resources: list[QGetToolsV4Item] | None = None
    voice_resources: list[QGetVoicesV4Item] | None = None

    # Legacy ID fields for backwards compatibility
    name_id: str | None = None
    description_id: str | None = None
    model_id: str | None = None
    prompt_id: str | None = None
    instructions_id: str | None = None
    active_flag_id: str | None = None
    temperature_level_id: str | None = None
    reasoning_level_id: str | None = None
    department_ids: list[str] | None = None
    tool_ids: list[str] | None = None
    voice_ids: list[str] | None = None


class AgentGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: agent_generation_progress.

    Emitted during agent resource generation to show progress.
    """

    artifact_type: str = "agent"


class AgentGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: agent_generation_error.

    Emitted when agent resource generation fails.
    """

    artifact_type: str = "agent"

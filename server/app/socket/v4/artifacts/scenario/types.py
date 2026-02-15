"""WebSocket-specific types for scenario generation.

Extends base artifact types with scenario-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.scenario.types import GetScenarioApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetImagesV4Item,
    QGetVideosV4Item,
)

# =============================================================================
# Client-to-Server Events (scenario_generate)
# =============================================================================


class GenerateScenarioPayload(GetScenarioApiRequest):
    """Request payload for scenario_generate WebSocket event.

    Extends GetScenarioApiRequest (which has scenario_id, draft_id, search terms)
    with generation-specific fields and form state.
    """

    # Generation-specific fields - resource-type-based API
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    save: bool = True  # Whether to auto-save scenario on completion


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ScenarioGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: scenario_generation_complete.

    Emitted when scenario generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    Media resources (images/videos) are still sent here as they require
    special upload linking not covered by the resource layer.
    """

    artifact_type: str = "scenario"

    # Media resources - still handled by artifact-level media handler
    image_resources: list[QGetImagesV4Item] | None = None
    video_resources: list[QGetVideosV4Item] | None = None


class ScenarioGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: scenario_generation_progress.

    Emitted during scenario resource generation to show progress.
    """

    artifact_type: str = "scenario"


class ScenarioGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: scenario_generation_error.

    Emitted when scenario resource generation fails.
    """

    artifact_type: str = "scenario"

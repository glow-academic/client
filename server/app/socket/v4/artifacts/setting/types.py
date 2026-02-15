"""WebSocket-specific types for setting generation.

Extends base artifact types with setting-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.setting.types import GetSettingApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Client-to-Server Events (setting_generate)
# =============================================================================


class GenerateSettingPayload(GetSettingApiRequest):
    """Request payload for setting_generate WebSocket event.

    Extends GetSettingApiRequest (which has setting_id, draft_id)
    with generation-specific fields.
    """

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class SettingGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: setting_generation_complete.

    Emitted when setting generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "setting"


class SettingGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: setting_generation_progress."""

    artifact_type: str = "setting"


class SettingGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: setting_generation_error."""

    artifact_type: str = "setting"

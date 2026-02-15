"""WebSocket-specific types for provider generation."""

from app.api.v4.artifacts.provider.types import GetProviderApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Client-to-Server Events (provider_generate)
# =============================================================================


class GenerateProviderPayload(GetProviderApiRequest):
    """Request payload for provider_generate WebSocket event.

    Extends GetProviderApiRequest with generation-specific fields.
    """

    resource_types: list[str]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ProviderGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: provider_generation_complete.

    Emitted when provider generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "provider"


class ProviderGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: provider_generation_progress.

    Emitted during provider resource generation to show progress.
    """

    artifact_type: str = "provider"


class ProviderGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: provider_generation_error.

    Emitted when provider resource generation fails.
    """

    artifact_type: str = "provider"

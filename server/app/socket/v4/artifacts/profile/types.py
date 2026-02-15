"""WebSocket-specific types for profile generation."""

from app.api.v4.artifacts.profile.types import GetProfileApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class GenerateProfilePayload(GetProfileApiRequest):
    """Client-to-server payload for `profile_generate`."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    staff_id: str | None = None


class ProfileGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: profile generation complete.

    Emitted when profile generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "profile"


class ProfileGenerationProgressEvent(GenerationProgressEvent):
    artifact_type: str = "profile"


class ProfileGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "profile"

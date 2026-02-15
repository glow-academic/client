"""WebSocket-specific types for auth generation."""

from app.api.v4.artifacts.auth.types import GetAuthApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

AUTH_GENERATE_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "protocols",
    "slugs",
    "items",
]


class GenerateAuthPayload(GetAuthApiRequest):
    """Request payload for auth_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None


class AuthGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: auth_generation_complete.

    Emitted when auth generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "auth"


class AuthGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: auth_generation_progress."""

    artifact_type: str = "auth"


class AuthGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: auth_generation_error."""

    artifact_type: str = "auth"

"""WebSocket-specific types for auth generation."""

from app.api.v4.artifacts.auth.types import AuthFlagConfig, GetAuthApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDescriptionsV4Item,
    QGetItemsV4Item,
    QGetNamesV4Item,
    QGetProtocolsV4Item,
    QGetSlugsV4Item,
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
    """Server-to-client event: auth_generation_complete."""

    artifact_type: str = "auth"

    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: AuthFlagConfig | None = None
    protocol_resources: list[QGetProtocolsV4Item] | None = None
    slug_resources: list[QGetSlugsV4Item] | None = None
    item_resources: list[QGetItemsV4Item] | None = None


class AuthGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: auth_generation_progress."""

    artifact_type: str = "auth"


class AuthGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: auth_generation_error."""

    artifact_type: str = "auth"

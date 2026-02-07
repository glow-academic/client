"""WebSocket-specific types for auth generation.

Extends base artifact types with auth-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.auth.types import GetAuthApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
    QGetProtocolsV4Item,
    QGetSlugsV4Item,
)

# =============================================================================
# Client-to-Server Events (auth_generate)
# =============================================================================


class GenerateAuthPayload(GetAuthApiRequest):
    """Request payload for auth_generate WebSocket event.

    Extends GetAuthApiRequest (which has auth_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[UUID]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class AuthGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: auth_generation_complete.

    Emitted when an auth resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "auth"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    protocol_resources: list[QGetProtocolsV4Item] | None = None
    slug_resources: list[QGetSlugsV4Item] | None = None


class AuthGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: auth_generation_progress.

    Emitted during auth resource generation to show progress.
    """

    artifact_type: str = "auth"


class AuthGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: auth_generation_error.

    Emitted when auth resource generation fails.
    """

    artifact_type: str = "auth"

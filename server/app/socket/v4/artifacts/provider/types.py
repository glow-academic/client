"""WebSocket-specific types for provider generation.

Extends base artifact types with provider-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.provider.types import GetProviderApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
    QGetRegeneratesV4Item,
    QGetValuesV4Item,
)

# =============================================================================
# Client-to-Server Events (provider_generate)
# =============================================================================


class GenerateProviderPayload(GetProviderApiRequest):
    """Request payload for provider_generate WebSocket event.

    Extends GetProviderApiRequest (which has provider_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[
        UUID
    ]  # Required: which domains to generate (client passes these through)
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Note: current selections are derived from draft-backed API response.
    # The server looks up agent_ids and group_ids from the domains mapping in get_provider_internal().


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ProviderGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: provider_generation_complete.

    Emitted when a provider resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "provider"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None
    value_resource: QGetValuesV4Item | None = None
    regenerates_resource: QGetRegeneratesV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None


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

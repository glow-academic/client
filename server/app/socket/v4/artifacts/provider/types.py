"""WebSocket-specific types for provider generation."""

from app.api.v4.artifacts.provider.types import GetProviderApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetEndpointsV4Item,
    QGetFlagsV4Item,
    QGetKeysV4Item,
    QGetNamesV4Item,
    QGetValuesV4Item,
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

    Emitted when a provider resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "provider"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None
    value_resource: QGetValuesV4Item | None = None
    endpoint_resource: QGetEndpointsV4Item | None = None
    key_resource: QGetKeysV4Item | None = None

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

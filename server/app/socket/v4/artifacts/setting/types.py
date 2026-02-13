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
from app.sql.types import (
    QGetAuthItemKeysV4Item,
    QGetAuthsV4Item,
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
    QGetProfilesV4Item,
    QGetProviderKeysV4Item,
    QGetRoleRoutesV4Item,
    QGetRolesV4Item,
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


# =============================================================================
# Server-to-Client Events
# =============================================================================


class SettingGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: setting_generation_complete.

    Emitted when a setting resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "setting"

    # Single-select resources
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources
    color_resources: list[QGetColorsV4Item] | None = None
    department_resources: list[QGetDepartmentsV4Item] | None = None
    profile_resources: list[QGetProfilesV4Item] | None = None
    auth_resources: list[QGetAuthsV4Item] | None = None
    provider_key_resources: list[QGetProviderKeysV4Item] | None = None
    auth_item_key_resources: list[QGetAuthItemKeysV4Item] | None = None
    role_resources: list[QGetRolesV4Item] | None = None
    role_route_resources: list[QGetRoleRoutesV4Item] | None = None


class SettingGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: setting_generation_progress."""

    artifact_type: str = "setting"


class SettingGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: setting_generation_error."""

    artifact_type: str = "setting"

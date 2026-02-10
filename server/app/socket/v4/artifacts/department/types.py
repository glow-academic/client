"""WebSocket-specific types for department generation."""

from app.api.v4.artifacts.department.types import GetDepartmentApiRequest
from app.api.v4.resources.settings.get import QGetSettingsV4Item
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
)

# =============================================================================
# Client-to-Server Events (department_generate)
# =============================================================================


class GenerateDepartmentPayload(GetDepartmentApiRequest):
    """Request payload for department_generate WebSocket event.

    Extends GetDepartmentApiRequest (which has department_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - resource-based API
    resource_types: list[str]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class DepartmentGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: department_generation_complete.

    Emitted when a department resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "department"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    settings_resources: list[QGetSettingsV4Item] | None = None


class DepartmentGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: department_generation_progress.

    Emitted during department resource generation to show progress.
    """

    artifact_type: str = "department"


class DepartmentGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: department_generation_error.

    Emitted when department resource generation fails.
    """

    artifact_type: str = "department"

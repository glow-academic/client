"""WebSocket-specific types for department generation."""

from app.api.v4.artifacts.department.types import GetDepartmentApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
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
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class DepartmentGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: department_generation_complete.

    Emitted when department generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "department"


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

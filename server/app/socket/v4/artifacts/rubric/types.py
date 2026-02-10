"""WebSocket-specific types for rubric generation.

Extends base artifact types with rubric-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.rubric.types import GetRubricApiRequest
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
    QGetPointsV4Item,
    QGetStandardGroupsV4Item,
    QGetStandardsV4Item,
)

# =============================================================================
# Client-to-Server Events (rubric_generate)
# =============================================================================


class GenerateRubricPayload(GetRubricApiRequest):
    """Request payload for rubric_generate WebSocket event.

    Extends GetRubricApiRequest (which has rubric_id, draft_id, search terms)
    with generation-specific fields.
    """

    # Generation-specific fields - resource-based API
    resource_types: list[str]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class RubricGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: rubric_generation_complete.

    Emitted when a rubric resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "rubric"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Points resources
    points_resource: QGetPointsV4Item | None = None
    pass_points_resource: QGetPointsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    standard_group_resources: list[QGetStandardGroupsV4Item] | None = None
    standard_resources: list[QGetStandardsV4Item] | None = None


class RubricGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: rubric_generation_progress.

    Emitted during rubric resource generation to show progress.
    """

    artifact_type: str = "rubric"


class RubricGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: rubric_generation_error.

    Emitted when rubric resource generation fails.
    """

    artifact_type: str = "rubric"

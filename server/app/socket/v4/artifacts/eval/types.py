"""WebSocket-specific types for eval generation."""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetGroupPositionsV4Item,
    QGetGroupRubricsV4Item,
    QGetNamesV4Item,
    QGetRubricsBatchV4Item,
    QGetRunPositionsV4Item,
    QGetRunRubricsV4Item,
)


class GenerateEvalPayload(BaseModel):
    """Request payload for eval_generate WebSocket event."""

    artifact_type: str = "eval"
    eval_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class EvalGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: eval_generation_complete."""

    artifact_type: str = "eval"

    # Single-select resources
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources
    department_resources: list[QGetDepartmentsV4Item] | None = None
    agent_resources: list[QGetAgentsV4Item] | None = None
    rubric_resources: list[QGetRubricsBatchV4Item] | None = None
    run_position_resources: list[QGetRunPositionsV4Item] | None = None
    group_position_resources: list[QGetGroupPositionsV4Item] | None = None
    run_rubric_resources: list[QGetRunRubricsV4Item] | None = None
    group_rubric_resources: list[QGetGroupRubricsV4Item] | None = None


class EvalGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: eval_generation_progress."""

    artifact_type: str = "eval"


class EvalGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: eval_generation_error."""

    artifact_type: str = "eval"

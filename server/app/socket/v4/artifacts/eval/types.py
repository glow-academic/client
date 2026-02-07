"""WebSocket-specific types for eval generation.

Extends base artifact types with eval-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.eval.types import GetEvalApiRequest
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
)

# =============================================================================
# Client-to-Server Events (eval_generate)
# =============================================================================


class GenerateEvalPayload(GetEvalApiRequest):
    """Request payload for eval_generate WebSocket event.

    Extends GetEvalApiRequest with generation-specific fields.
    """

    domain_ids: list[UUID]
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


class EvalGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: eval_generation_progress."""

    artifact_type: str = "eval"


class EvalGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: eval_generation_error."""

    artifact_type: str = "eval"

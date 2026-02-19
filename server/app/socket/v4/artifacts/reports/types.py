"""WebSocket-specific types for reports generation.

Extends base artifact types with reports-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.reports.types import GetReportsApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

# Reports has no resource types (operational view — generation produces runs/insights)
REPORTS_RESOURCE_TYPES: list[str] = []

REPORTS_SYNC_ENTRY_TYPES = ["runs"]

REPORTS_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (reports_generate)
# =============================================================================


class GenerateReportsPayload(GetReportsApiRequest):
    """Request payload for reports_generate WebSocket event.

    Extends GetReportsApiRequest (which has reports_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    save: bool = True  # Whether to auto-save on completion


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ReportsGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: reports_generation_complete.

    Emitted when all agents have finished generating reports resources.
    """

    artifact_type: str = "reports"
    reports_id: str | None = None


class ReportsGenerationProgressEvent(BaseModel):
    """Server-to-client event: reports_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "reports"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class ReportsGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: reports_generation_error.

    Emitted when reports resource generation fails.
    """

    artifact_type: str = "reports"

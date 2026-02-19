"""WebSocket-specific types for dashboard generation.

Extends base artifact types with dashboard-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.dashboard.types import GetDashboardApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

DASHBOARD_RESOURCE_TYPES: list[str] = []

DASHBOARD_SYNC_ENTRY_TYPES = ["runs"]

DASHBOARD_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (dashboard_generate)
# =============================================================================


class GenerateDashboardPayload(GetDashboardApiRequest):
    """Request payload for dashboard_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class DashboardGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: dashboard_generation_complete."""

    artifact_type: str = "dashboard"
    dashboard_id: str | None = None


class DashboardGenerationProgressEvent(BaseModel):
    """Server-to-client event: dashboard_generation_progress."""

    artifact_type: str = "dashboard"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str | None = None


class DashboardGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: dashboard_generation_error."""

    artifact_type: str = "dashboard"

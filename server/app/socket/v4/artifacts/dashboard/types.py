"""WebSocket-specific types for dashboard generation.

Extends base artifact types with dashboard-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class DashboardGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: dashboard_generation_complete."""

    artifact_type: str = "dashboard"


class DashboardGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: dashboard_generation_progress."""

    artifact_type: str = "dashboard"


class DashboardGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: dashboard_generation_error."""

    artifact_type: str = "dashboard"

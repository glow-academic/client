"""WebSocket-specific types for suite generation.

Extends base artifact types with suite-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.suite.types import GetSuiteApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

# Suite has no resource types (operational view — generation produces runs/insights)
SUITE_RESOURCE_TYPES: list[str] = []

SUITE_SYNC_ENTRY_TYPES = ["runs"]

SUITE_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (suite_generate)
# =============================================================================


class GenerateSuitePayload(GetSuiteApiRequest):
    """Request payload for suite_generate WebSocket event.

    Extends GetSuiteApiRequest (which has benchmark_entry_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    save: bool = True  # Whether to auto-save on completion


# =============================================================================
# Server-to-Client Events
# =============================================================================


class SuiteGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: suite_generation_complete.

    Emitted when all agents have finished generating suite resources.
    """

    artifact_type: str = "suite"
    benchmark_entry_id: str | None = None


class SuiteGenerationProgressEvent(BaseModel):
    """Server-to-client event: suite_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "suite"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class SuiteGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: suite_generation_error.

    Emitted when suite resource generation fails.
    """

    artifact_type: str = "suite"

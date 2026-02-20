"""WebSocket-specific types for invocation generation.

Extends base artifact types with invocation-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.invocation.types import GetInvocationApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

# Invocation has no resource types (operational view — generation produces runs/insights)
INVOCATION_RESOURCE_TYPES: list[str] = []

INVOCATION_SYNC_ENTRY_TYPES = ["runs"]

INVOCATION_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (invocation_generate)
# =============================================================================


class GenerateInvocationPayload(GetInvocationApiRequest):
    """Request payload for invocation_generate WebSocket event.

    Extends GetInvocationApiRequest (which has benchmark_entry_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    save: bool = True  # Whether to auto-save on completion


# =============================================================================
# Server-to-Client Events
# =============================================================================


class InvocationGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: invocation_generation_complete.

    Emitted when all agents have finished generating invocation resources.
    """

    artifact_type: str = "invocation"
    benchmark_entry_id: str | None = None


class InvocationGenerationProgressEvent(BaseModel):
    """Server-to-client event: invocation_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "invocation"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class InvocationGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: invocation_generation_error.

    Emitted when invocation resource generation fails.
    """

    artifact_type: str = "invocation"

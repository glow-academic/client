"""WebSocket-specific types for benchmark bundle generation.

Extends base artifact types with benchmark-bundle-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

# Resource types that benchmark bundle generation can produce
BENCHMARK_BUNDLE_GENERATE_RESOURCE_TYPES = [
    "departments",
    "models",
    "prompts",
    "instructions",
    "voices",
    "temperature_levels",
    "reasoning_levels",
    "tools",
    "keys",
]

BENCHMARK_BUNDLE_SYNC_ENTRY_TYPES = ["runs"]

BENCHMARK_BUNDLE_ASYNC_ENTRY_TYPES = ["debug_info"]


# =============================================================================
# Client-to-Server Events (suite_generate)
# =============================================================================


class GenerateSuitePayload(BaseModel):
    """Request payload for suite_generate WebSocket event."""

    suite_entry_id: UUID
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class SuiteGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: suite_generation_complete.

    Emitted when all agents have finished generating benchmark bundle resources.
    """

    artifact_type: str = "suite"
    attempt_id: str | None = None
    chat_id: str | None = None


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

    Emitted when benchmark bundle resource generation fails.
    """

    artifact_type: str = "suite"

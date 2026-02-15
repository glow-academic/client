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


# =============================================================================
# Client-to-Server Events (benchmark_bundle_generate)
# =============================================================================


class GenerateBenchmarkBundlePayload(BaseModel):
    """Request payload for benchmark_bundle_generate WebSocket event."""

    benchmark_bundle_entry_id: UUID
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class BenchmarkBundleGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: benchmark_bundle_generation_complete.

    Emitted when all agents have finished generating benchmark bundle resources.
    """

    artifact_type: str = "benchmark_bundle"
    attempt_id: str | None = None
    chat_id: str | None = None


class BenchmarkBundleGenerationProgressEvent(BaseModel):
    """Server-to-client event: benchmark_bundle_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "benchmark_bundle"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class BenchmarkBundleGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: benchmark_bundle_generation_error.

    Emitted when benchmark bundle resource generation fails.
    """

    artifact_type: str = "benchmark_bundle"

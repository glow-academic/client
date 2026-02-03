"""Types for benchmark socket events.

Defines payload and event types for benchmark orchestration:
- BenchmarkStartPayload: client entry point (single call)
- BenchmarkStartedEvent: emitted when attempt is created
- BenchmarkProgressEvent: emitted during benchmark execution
- BenchmarkCompleteEvent: emitted when all tests complete
- BenchmarkErrorEvent: emitted on errors
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class BenchmarkStartPayload(BaseModel):
    """Request payload for benchmark_start WebSocket event."""

    eval_id: UUID
    infinite_mode: bool = False


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class BenchmarkStartedEvent(BaseModel):
    """Server-to-client event: benchmarks_started."""

    artifact_type: str = "benchmark"
    success: bool = True
    message: str
    attempt_id: str
    eval_id: str | None = None
    use_groups: bool | None = None
    pending_run_ids: list[str] | None = None
    pending_group_ids: list[str] | None = None


class BenchmarkProgressEvent(BaseModel):
    """Server-to-client event: benchmarks_progress."""

    artifact_type: str = "benchmark"
    attempt_id: str | None = None
    test_id: str | None = None
    run_id: str | None = None
    group_id: str | None = None
    status: str | None = None
    message: str | None = None
    success: bool = True


class BenchmarkCompleteEvent(BaseModel):
    """Server-to-client event: benchmarks_complete."""

    artifact_type: str = "benchmark"
    success: bool = True
    message: str
    attempt_id: str
    test_id: str | None = None


class BenchmarkErrorEvent(BaseModel):
    """Server-to-client event: benchmarks_error."""

    artifact_type: str = "benchmark"
    success: bool = False
    message: str
    attempt_id: str | None = None
    test_id: str | None = None
    run_id: str | None = None
    group_id: str | None = None
    error_type: str | None = None


# =============================================================================
# Internal Event Payloads
# =============================================================================


class BenchmarkNextPayload(BaseModel):
    """Internal event payload to process next run/group for benchmark attempt."""

    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    use_groups: bool = False


class BenchmarkAdvancePayload(BaseModel):
    """Internal event payload to advance benchmark progress."""

    test_id: str
    attempt_id: str
    run_id: str | None = None
    group_id: str | None = None


class BenchmarkEndPayload(BaseModel):
    """Internal event payload to end benchmark test and run grading."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    use_groups: bool = False


class BenchmarkEvalCompletePayload(BaseModel):
    """Internal event payload for eval completion."""

    success: bool = True
    message: str | None = None
    sid: str | None = None
    attempt_id: str | None = None
    test_id: str | None = None
    eval_id: str | None = None
    run_id: str | None = None
    group_id: str | None = None
    agent_id: str | None = None
    tool_id: str | None = None
    metadata: dict[str, Any] | None = None

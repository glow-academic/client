"""Types for benchmark socket events.

Defines payload and event types for benchmark start:
- BenchmarkStartPayload: client entry point
- BenchmarkStartedEvent: emitted with structure for client to control
- BenchmarkProgressEvent: emitted during benchmark execution
- BenchmarkCompleteEvent: emitted when all tests complete
- BenchmarkErrorEvent: emitted on errors

Test execution is handled by test/ handlers (test_run, test_run_all, test_grade).
"""

from uuid import UUID

from pydantic import BaseModel

# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class BenchmarkStartPayload(BaseModel):
    """Request payload for benchmark_start WebSocket event.

    Creates benchmark attempt structure. Client then controls
    execution via test_run/test_run_all.
    """

    eval_id: UUID
    infinite_mode: bool = False


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class BenchmarkChatInfo(BaseModel):
    """Info about a benchmark chat (test instance).

    Each chat represents one run or group to be tested.
    """

    chat_id: str
    run_resource_id: str | None = None
    group_resource_id: str | None = None
    status: str = "pending"  # pending, running, completed, failed
    total_runs: int = 1
    completed_runs: int = 0


class BenchmarkStartedEvent(BaseModel):
    """Server-to-client event: benchmark_started.

    Emitted when benchmark attempt is created with structure.
    Client uses chat_ids to trigger test_run/test_run_all.
    """

    artifact_type: str = "benchmark"
    success: bool = True
    message: str
    attempt_id: str
    eval_id: str | None = None
    use_groups: bool = False
    chats: list[BenchmarkChatInfo] = []


class BenchmarkProgressEvent(BaseModel):
    """Server-to-client event: benchmark_progress.

    Emitted during benchmark execution to show overall progress.
    """

    artifact_type: str = "benchmark"
    attempt_id: str
    total_chats: int | None = None
    completed_chats: int | None = None
    status: str | None = None
    message: str | None = None


class BenchmarkCompleteEvent(BaseModel):
    """Server-to-client event: benchmark_complete.

    Emitted when all tests in benchmark are complete.
    """

    artifact_type: str = "benchmark"
    success: bool = True
    message: str
    attempt_id: str
    total_chats: int | None = None
    passed_chats: int | None = None


class BenchmarkErrorEvent(BaseModel):
    """Server-to-client event: benchmark_error.

    Emitted on errors.
    """

    artifact_type: str = "benchmark"
    success: bool = False
    message: str
    attempt_id: str | None = None
    chat_id: str | None = None
    error_type: str | None = None

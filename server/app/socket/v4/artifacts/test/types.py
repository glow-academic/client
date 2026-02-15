"""Types for test socket events.

Defines payload and event types for the test WebSocket handlers:
- TestStartPayload: Start test (create or next mode)
- TestRunPayload: Run one auto-regressive replay
- TestGradePayload: Grade a test

Entry types are predefined per handler (not in payload):
- run.py: Auto-regressive replay tools
- grade.py: ['grades', 'feedbacks'] - Grading tools

Follows attempt/types.py pattern.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

# =============================================================================
# Entry type constants (predefined per handler, not in payload)
# =============================================================================

TEST_RUN_ENTRY_TYPES: list[str] = []
TEST_GRADE_ENTRY_TYPES = ["grades", "feedbacks"]


# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class TestStartPayload(BaseModel):
    """Request payload for test_start WebSocket event.

    Dual-mode:
    - Create mode (has eval_id, no test_id): Create test + invocations
    - Next mode (has test_id): Find next invocation with pending runs
    """

    eval_id: UUID | None = None
    test_id: UUID | None = None
    infinite_mode: bool = False


class TestRunPayload(BaseModel):
    """Request payload for test_run WebSocket event.

    Runs ONE auto-regressive replay for the next pending run.
    """

    invocation_id: UUID
    test_id: UUID


class TestGradePayload(BaseModel):
    """Request payload for test_grade WebSocket event.

    Triggers grading via rubric after runs complete.
    """

    invocation_id: UUID  # which invocation
    test_id: UUID  # for get_test_websocket()
    run_id: UUID  # the replay run being graded


class TestJoinPayload(BaseModel):
    """Request payload for test_join WebSocket event.

    Joins a test room for real-time updates.
    """

    invocation_id: UUID


class TestLeavePayload(BaseModel):
    """Request payload for test_leave WebSocket event.

    Leaves a test room.
    """

    invocation_id: UUID


class TestStopPayload(BaseModel):
    """Request payload for test_stop WebSocket event.

    Stops the current run generation.
    """

    invocation_id: UUID


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class TestStartedEvent(BaseModel):
    """Server-to-client event: test_started.

    Emitted when a test is created successfully.
    """

    test_id: str


class TestJoinedEvent(BaseModel):
    """Server-to-client event: test_joined.

    Emitted when a client successfully joins a test room.
    """

    invocation_id: str
    success: bool = True


class TestRunStartEvent(BaseModel):
    """Server-to-client event: test_run_start.

    Emitted when a run replay starts.
    """

    invocation_id: str
    run_id: str
    original_run_resource_id: str | None = None
    current_run: int
    total_runs: int
    created_at: str


class TestRunDeltaEvent(BaseModel):
    """Server-to-client event: test_run_delta.

    Emitted during generation with progress.
    """

    invocation_id: str
    run_id: str
    content: str  # accumulated content


class TestRunCompleteEvent(BaseModel):
    """Server-to-client event: test_run_complete.

    Emitted when a single run replay completes.
    """

    invocation_id: str
    run_id: str
    original_run_resource_id: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    current_run: int
    total_runs: int
    remaining_runs: int


class TestAllCompleteEvent(BaseModel):
    """Server-to-client event: test_all_complete.

    Emitted when all runs are complete.
    """

    invocation_id: str
    total_runs: int
    success: bool = True


class TestGradedEvent(BaseModel):
    """Server-to-client event: test_graded.

    Emitted when grading completes.
    """

    invocation_id: str
    grade_id: str | None = None
    score: float | None = None
    passed: bool | None = None
    feedback: str | None = None


class TestProgressEvent(BaseModel):
    """Server-to-client event: test_progress.

    Emitted during test execution.
    """

    invocation_id: str
    type: str  # "run_start", "run_delta", "run_complete", "grading", etc.
    run_id: str | None = None
    current_run: int | None = None
    total_runs: int | None = None
    message: str | None = None


class TestStoppedEvent(BaseModel):
    """Server-to-client event: test_stopped.

    Emitted when generation is stopped.
    """

    invocation_id: str
    success: bool = True
    message: str | None = None


class TestErrorEvent(BaseModel):
    """Server-to-client event: test_error.

    Emitted on errors.
    """

    invocation_id: str | None = None
    run_id: str | None = None
    message: str
    error_type: str | None = None

"""Types for test socket events.

Defines payload and event types for the test WebSocket handlers:
- TestRunPayload: Run one auto-regressive replay
- TestRunAllPayload: Run all remaining auto-regressive replays
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


class TestRunPayload(BaseModel):
    """Request payload for test_run WebSocket event.

    Runs ONE auto-regressive replay for the next pending run.
    """

    chat_id: UUID
    test_id: UUID
    run_all: bool = False


class TestRunAllPayload(BaseModel):
    """Request payload for test_run_all WebSocket event.

    Runs ALL remaining auto-regressive replays sequentially.
    """

    chat_id: UUID
    test_id: UUID


class TestGradePayload(BaseModel):
    """Request payload for test_grade WebSocket event.

    Triggers grading via rubric after runs complete.
    """

    chat_id: UUID


class TestJoinPayload(BaseModel):
    """Request payload for test_join WebSocket event.

    Joins a test room for real-time updates.
    """

    chat_id: UUID


class TestLeavePayload(BaseModel):
    """Request payload for test_leave WebSocket event.

    Leaves a test room.
    """

    chat_id: UUID


class TestStopPayload(BaseModel):
    """Request payload for test_stop WebSocket event.

    Stops the current run generation.
    """

    chat_id: UUID


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class TestJoinedEvent(BaseModel):
    """Server-to-client event: test_joined.

    Emitted when a client successfully joins a test room.
    """

    chat_id: str
    success: bool = True


class TestRunStartEvent(BaseModel):
    """Server-to-client event: test_run_start.

    Emitted when a run replay starts.
    """

    chat_id: str
    run_id: str
    original_run_resource_id: str | None = None
    current_run: int
    total_runs: int
    created_at: str


class TestRunDeltaEvent(BaseModel):
    """Server-to-client event: test_run_delta.

    Emitted during generation with progress.
    """

    chat_id: str
    run_id: str
    content: str  # accumulated content


class TestRunCompleteEvent(BaseModel):
    """Server-to-client event: test_run_complete.

    Emitted when a single run replay completes.
    """

    chat_id: str
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

    chat_id: str
    total_runs: int
    success: bool = True


class TestGradedEvent(BaseModel):
    """Server-to-client event: test_graded.

    Emitted when grading completes.
    """

    chat_id: str
    grade_id: str | None = None
    score: float | None = None
    passed: bool | None = None
    feedback: str | None = None


class TestProgressEvent(BaseModel):
    """Server-to-client event: test_progress.

    Emitted during test execution.
    """

    chat_id: str
    type: str  # "run_start", "run_delta", "run_complete", "grading", etc.
    run_id: str | None = None
    current_run: int | None = None
    total_runs: int | None = None
    message: str | None = None


class TestStoppedEvent(BaseModel):
    """Server-to-client event: test_stopped.

    Emitted when generation is stopped.
    """

    chat_id: str
    success: bool = True
    message: str | None = None


class TestErrorEvent(BaseModel):
    """Server-to-client event: test_error.

    Emitted on errors.
    """

    chat_id: str | None = None
    run_id: str | None = None
    message: str
    error_type: str | None = None

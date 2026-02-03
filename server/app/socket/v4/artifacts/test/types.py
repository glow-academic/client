"""Types for test socket events."""

from uuid import UUID

from pydantic import BaseModel


# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class TestJoinPayload(BaseModel):
    """Request payload for test_join WebSocket event."""

    attempt_id: UUID


class TestLeavePayload(BaseModel):
    """Request payload for test_leave WebSocket event."""

    attempt_id: UUID


class TestStopPayload(BaseModel):
    """Request payload for test_stop WebSocket event."""

    attempt_id: UUID


class TestSendPayload(BaseModel):
    """Request payload for test_send WebSocket event."""

    attempt_id: UUID
    content: str | None = None


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class TestJoinedEvent(BaseModel):
    """Server-to-client event: test_joined."""

    attempt_id: str
    success: bool = True


class TestStoppedEvent(BaseModel):
    """Server-to-client event: test_stopped."""

    attempt_id: str
    success: bool = True
    message: str | None = None


class TestProgressEvent(BaseModel):
    """Server-to-client event: test_progress."""

    attempt_id: str
    test_id: str | None = None
    run_id: str | None = None
    group_id: str | None = None
    status: str | None = None
    message: str | None = None
    success: bool = True


class TestCompleteEvent(BaseModel):
    """Server-to-client event: test_complete."""

    attempt_id: str
    test_id: str | None = None
    success: bool = True
    message: str | None = None


class TestErrorEvent(BaseModel):
    """Server-to-client event: test_error."""

    attempt_id: str | None = None
    test_id: str | None = None
    success: bool = False
    message: str
    error_type: str | None = None

"""Unified event model for test_invocation entry socket events."""

from app.api.v4.entries.test_invocation.types import TestInvocationEntryData


class TestInvocationGenerationEvent(TestInvocationEntryData):
    """Unified socket event for test_invocation generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "test_invocation"
    entry_id: str | None = None
    group_id: str | None = None
    run_id: str | None = None
    # Completion
    success: bool | None = None
    # Error
    message: str | None = None
    error_stage: str | None = None
    # Tool call tracking
    tool_call_id: str | None = None
    tool_name: str | None = None
    # Streaming
    arguments_delta: str | None = None

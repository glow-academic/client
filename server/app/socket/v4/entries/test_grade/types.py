"""Unified event model for test_grade entry socket events."""

from app.api.v4.entries.test_grade.types import TestGradeEntryData


class TestGradeGenerationEvent(TestGradeEntryData):
    """Unified socket event for test_grade generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "test_grade"
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

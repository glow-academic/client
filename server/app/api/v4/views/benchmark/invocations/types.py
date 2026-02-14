"""Types for benchmark invocations view (mv_benchmark_invocations)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkFeedbackItem(BaseModel):
    """Feedback item from benchmark grade."""

    id: UUID | None = None
    total: int | None = None
    feedback: str | None = None
    total_points: int | None = None
    pass_points: int | None = None


class BenchmarkInvocationViewItem(BaseModel):
    """Single benchmark invocation row from mv_benchmark_invocations."""

    # Primary key
    invocation_id: UUID

    # Foreign keys
    test_id: UUID
    group_id: UUID | None = None
    benchmark_bundle_department_id: UUID | None = None

    # Invocation data
    created_at: datetime | None = None
    title: str | None = None

    # Grade data
    invocation_completed: bool = False
    grade_score: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None
    rubric_id: UUID | None = None

    # Feedbacks
    feedbacks: list[BenchmarkFeedbackItem] | None = None

    # Actual execution runs (from invocation-level connection)
    invocation_run_ids: list[UUID] = Field(default_factory=list)

    # Configured resource IDs (from bundle department snapshot)
    run_ids: list[UUID] = Field(default_factory=list)
    group_ids: list[UUID] = Field(default_factory=list)
    model_ids: list[UUID] = Field(default_factory=list)
    prompt_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    voice_ids: list[UUID] = Field(default_factory=list)
    temperature_level_ids: list[UUID] = Field(default_factory=list)
    reasoning_level_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    key_ids: list[UUID] = Field(default_factory=list)


class GetBenchmarkInvocationsRequest(BaseModel):
    """Request for benchmark invocations view filtering."""

    test_id: UUID | None = Field(default=None)
    invocation_ids: list[UUID] = Field(default_factory=list)
    # Backward-compat for existing clients
    chat_ids: list[UUID] = Field(default_factory=list)


class GetBenchmarkInvocationsResponse(BaseModel):
    """Response for benchmark invocations view."""

    items: list[BenchmarkInvocationViewItem] = Field(default_factory=list)

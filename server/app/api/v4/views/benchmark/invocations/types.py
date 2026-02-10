"""Types for benchmark invocations view (mv_benchmark_invocations)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkInvocationViewItem(BaseModel):
    """Single benchmark invocation row from mv_benchmark_invocations."""

    invocation_id: UUID
    test_id: UUID
    eval_id: UUID | None = None
    run_ids: list[UUID] = Field(default_factory=list)
    group_id: UUID | None = None
    invocation_created_at: datetime | None = None
    invocation_updated_at: datetime | None = None
    invocation_title: str | None = None
    invocation_completed: bool = False
    grade_score: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None
    num_messages: int = 0


class GetBenchmarkInvocationsRequest(BaseModel):
    """Request for benchmark invocations view filtering."""

    test_id: UUID | None = Field(default=None)
    invocation_ids: list[UUID] = Field(default_factory=list)
    # Backward-compat for existing clients
    chat_ids: list[UUID] = Field(default_factory=list)


class GetBenchmarkInvocationsResponse(BaseModel):
    """Response for benchmark invocations view."""

    items: list[BenchmarkInvocationViewItem] = Field(default_factory=list)

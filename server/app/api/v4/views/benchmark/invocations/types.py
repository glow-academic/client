"""Types for benchmark invocations view (lean — no composites)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkInvocationViewItem(BaseModel):
    """Single benchmark invocation row from mv_test_invocation.

    Lean: entry attrs + resource IDs + grade scalars only. Feedbacks
    fetched via simulation/test_feedback view.
    """

    # Primary key
    invocation_id: UUID

    # Foreign keys
    test_id: UUID
    group_id: UUID | None = None
    suite_department_id: UUID | None = None

    # Invocation data
    created_at: datetime | None = None
    title: str | None = None

    # Grade data
    invocation_completed: bool = False
    grade_score: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None
    rubric_id: UUID | None = None
    grade_id: UUID | None = None

    # Actual execution runs (from invocation-level connection)
    invocation_run_ids: list[UUID] = Field(default_factory=list)

    # Configured resource IDs (from bundle department snapshot)
    # Arrays (multiple per department)
    run_ids: list[UUID] = Field(default_factory=list)
    group_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    # Singular (one per department entry)
    model_id: UUID | None = None
    prompt_id: UUID | None = None
    voice_id: UUID | None = None
    temperature_level_id: UUID | None = None
    reasoning_level_id: UUID | None = None
    key_id: UUID | None = None

    # Historical runs (all runs in invocation's group)
    historical_run_ids: list[UUID] = Field(default_factory=list)


class GetBenchmarkInvocationsRequest(BaseModel):
    """Request for benchmark invocations view filtering."""

    test_id: UUID | None = Field(default=None)
    invocation_ids: list[UUID] = Field(default_factory=list)
    # Backward-compat for existing clients
    chat_ids: list[UUID] = Field(default_factory=list)


class GetBenchmarkInvocationsResponse(BaseModel):
    """Response for benchmark invocations view."""

    items: list[BenchmarkInvocationViewItem] = Field(default_factory=list)

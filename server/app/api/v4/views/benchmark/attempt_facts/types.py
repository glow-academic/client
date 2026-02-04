"""Types for benchmark attempt facts view (mv_benchmark_attempt_facts)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkAttemptFactsItem(BaseModel):
    """Single attempt from mv_benchmark_attempt_facts."""

    attempt_id: UUID
    eval_id: UUID | None = None
    rubric_id: UUID | None = None

    department_ids: list[UUID] | None = None

    attempt_created_at: datetime | None = None

    archived: bool = False

    total_runs: int = 0
    completed_runs: int = 0
    pending_runs: int = 0

    status: str = "pending"  # 'pending' | 'running' | 'completed'


class GetBenchmarkAttemptFactsRequest(BaseModel):
    """Request for getting benchmark attempt facts."""

    eval_id: UUID | None = Field(default=None)
    rubric_id: UUID | None = Field(default=None)
    status: str | None = Field(default=None)
    archived: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    sort_by: str = Field(default="date", description="'date' | 'status'")
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetBenchmarkAttemptFactsResponse(BaseModel):
    """Response with benchmark attempt facts."""

    items: list[BenchmarkAttemptFactsItem] = Field(default_factory=list)
    total_count: int = Field(default=0)

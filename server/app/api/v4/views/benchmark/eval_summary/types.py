"""Types for benchmark eval summary view (mv_benchmark_eval_summary)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkEvalSummaryItem(BaseModel):
    """Single eval from mv_benchmark_eval_summary."""

    eval_id: UUID
    rubric_id: UUID | None = None
    agent_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None

    eval_name_id: UUID | None = None
    eval_description_id: UUID | None = None
    agent_name_ids: list[UUID] | None = None

    created_at: datetime | None = None
    updated_at: datetime | None = None

    use_groups: bool = False
    dynamic: bool = False

    total_runs: int = 0
    completed_runs: int = 0
    pending_runs: int = 0

    status: str = "pending"  # 'pending' | 'running' | 'completed'


class GetBenchmarkEvalSummaryRequest(BaseModel):
    """Request for getting benchmark eval summary."""

    rubric_id: UUID | None = Field(default=None)
    status: str | None = Field(default=None)

    sort_by: str = Field(default="date", description="'date' | 'status' | 'runs'")
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetBenchmarkEvalSummaryResponse(BaseModel):
    """Response with benchmark eval summary."""

    items: list[BenchmarkEvalSummaryItem] = Field(default_factory=list)
    total_count: int = Field(default=0)

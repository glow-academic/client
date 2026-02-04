"""Types for benchmark artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.benchmark.attempt_facts.types import BenchmarkAttemptFactsItem
from app.api.v4.views.benchmark.eval_summary.types import BenchmarkEvalSummaryItem


class BenchmarkRequest(BaseModel):
    """Request for getting benchmark data."""

    eval_id: UUID | None = Field(default=None)
    rubric_id: UUID | None = Field(default=None)
    status: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class BenchmarkViews(BaseModel):
    """Benchmark view data."""

    attempt_facts: list[BenchmarkAttemptFactsItem] = Field(default_factory=list)
    eval_summary: list[BenchmarkEvalSummaryItem] = Field(default_factory=list)


class BenchmarkResources(BaseModel):
    """Benchmark resource metadata."""

    evals: dict[str, dict] = Field(default_factory=dict)
    rubrics: dict[str, dict] = Field(default_factory=dict)


class BenchmarkResponse(BaseModel):
    """Response with benchmark data."""

    views: BenchmarkViews = Field(default_factory=BenchmarkViews)
    resources: BenchmarkResources = Field(default_factory=BenchmarkResources)
    total_count: int = Field(default=0)

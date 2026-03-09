"""Types for benchmark artifact."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.auth.types import AnalyticsFacets
from app.routes.v5.api.main.types import FilterOption


class BenchmarkRequest(BaseModel):
    """Request for getting benchmark data."""

    start_date: str | None = None
    end_date: str | None = None
    department_ids: list[str] = Field(default_factory=list)
    # History params
    history_page: int = 0
    history_page_size: int = 10
    history_eval_ids: list[str] = Field(default_factory=list)
    history_search: str | None = None
    history_archived: bool | None = None
    history_sort_by: str = "date"
    history_sort_order: str = "desc"


class BenchmarkEvalOperational(BaseModel):
    """Eval card for the benchmark page — analogous to ChatSimulationOperational."""

    # Identity
    eval_id: str
    eval_name: str | None = None
    eval_description: str | None = None

    # Models (analogous to scenarios in home)
    model_ids: list[str] = Field(default_factory=list)

    # Stats
    total_tests: int = 0
    archived_tests: int = 0
    total_invocations: int = 0
    completed_invocations: int = 0
    highest_score: float | None = None
    has_passed: bool = False

    # Computed
    status: str = "not-started"
    infinite_mode: bool = False

    # Departments
    department_ids: list[str] = Field(default_factory=list)

    # Rubric
    rubric_ids: list[str] = Field(default_factory=list)


class BenchmarkDepartmentItem(BaseModel):
    """Department resource for benchmark."""

    department_id: str
    name: str | None = None
    description: str | None = None


class BenchmarkHistoryItem(BaseModel):
    """History row for a test — analogous to TestHistoryItem."""

    test_id: str
    eval_id: str | None = None
    eval_name: str | None = None
    eval_description: str | None = None
    created_at: str | None = None
    archived: bool = False
    infinite_mode: bool = False

    # Invocation stats
    total_invocations: int = 0
    completed_invocations: int = 0
    pending_invocations: int = 0

    # Best score across invocations
    best_score: float | None = None
    has_passed: bool = False

    status: str = "pending"


class BenchmarkHistoryResponse(BaseModel):
    """Paginated history response."""

    data: list[BenchmarkHistoryItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 10
    eval_options: list[FilterOption] = Field(default_factory=list)


class BenchmarkResponse(BaseModel):
    """Response with benchmark data."""

    evals: list[BenchmarkEvalOperational] = Field(default_factory=list)
    departments: list[BenchmarkDepartmentItem] = Field(default_factory=list)
    department_options: list[FilterOption] = Field(default_factory=list)
    date_range_earliest: str | None = None
    date_range_latest: str | None = None
    history: BenchmarkHistoryResponse | None = None
    analytics: AnalyticsFacets | None = None


# =============================================================================
# Export Types
# =============================================================================


class ExportBenchmarkApiResponse(BaseModel):
    """Response model for benchmark export."""

    upload_id: UUID
    file_name: str
    row_count: int

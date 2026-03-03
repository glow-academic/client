"""Types for benchmark artifact."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.v5.api.main.types import FilterOption, TestHistoryResponse


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


class BenchmarkEvalCard(BaseModel):
    """Eval card for the benchmark page — analogous to simulation card on home."""

    eval_id: str
    name: str | None = None
    description: str | None = None
    department_ids: list[str] = Field(default_factory=list)
    # Aggregated test stats
    total_tests: int = 0
    archived_tests: int = 0


class BenchmarkDepartmentItem(BaseModel):
    """Department resource for benchmark."""

    department_id: str
    name: str | None = None
    description: str | None = None


class BenchmarkResponse(BaseModel):
    """Response with benchmark data."""

    evals: list[BenchmarkEvalCard] = Field(default_factory=list)
    departments: list[BenchmarkDepartmentItem] = Field(default_factory=list)
    department_options: list[FilterOption] = Field(default_factory=list)
    date_range_earliest: str | None = None
    date_range_latest: str | None = None
    history: TestHistoryResponse | None = None

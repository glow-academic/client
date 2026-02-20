"""Types for benchmark artifact."""

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption, TestHistoryResponse
from app.sql.types import (
    QGetTestViewV4Item,
)


class BenchmarkRequest(BaseModel):
    """Request for getting benchmark data."""

    start_date: str | None = None
    end_date: str | None = None
    department_ids: list[str] = Field(default_factory=list)
    # History params
    history_enabled: bool = False
    history_page: int = 0
    history_page_size: int = 10
    history_eval_ids: list[str] = Field(default_factory=list)
    history_search: str | None = None
    history_status: str | None = None
    history_archived: bool | None = None
    history_sort_by: str = "date"
    history_sort_order: str = "desc"


class BenchmarkEvalItem(BaseModel):
    """Eval resource metadata for benchmark hydration."""

    eval_id: str
    name: str | None = None
    description: str | None = None
    department_ids: list[str] = Field(default_factory=list)


class BenchmarkRubricItem(BaseModel):
    """Rubric resource for benchmark."""

    rubric_id: str
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None


class BenchmarkDepartmentItem(BaseModel):
    """Department resource for benchmark."""

    department_id: str
    name: str | None = None
    description: str | None = None


class BenchmarkAgentItem(BaseModel):
    """Agent resource for benchmark."""

    agent_id: str
    name: str | None = None
    description: str | None = None


class BenchmarkStandardGroupItem(BaseModel):
    """Standard group resource for benchmark."""

    standard_group_id: str
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None


class BenchmarkStandardItem(BaseModel):
    """Standard resource for benchmark."""

    standard_id: str
    standard_group_id: str | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None


class BenchmarkRubricStandardGroupItem(BaseModel):
    """Mapping of rubric -> standard_group -> standard_ids."""

    rubric_id: str
    standard_group_id: str
    standard_ids: list[str] = Field(default_factory=list)


class BenchmarkResponse(BaseModel):
    """Response with benchmark data."""

    tests: list[QGetTestViewV4Item] = Field(default_factory=list)
    total_count: int = 0
    evals: list[BenchmarkEvalItem] = Field(default_factory=list)
    departments: list[BenchmarkDepartmentItem] = Field(default_factory=list)

    department_options: list[FilterOption] = Field(default_factory=list)
    date_range_earliest: str | None = None
    date_range_latest: str | None = None
    history: TestHistoryResponse | None = None

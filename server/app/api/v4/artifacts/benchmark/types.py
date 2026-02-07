"""Types for benchmark artifact."""

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption


class BenchmarkRequest(BaseModel):
    """Request for getting benchmark data."""

    department_ids: list[str] = Field(default_factory=list)


class BenchmarkEvalItem(BaseModel):
    """Enriched eval item for benchmark overview."""

    eval_id: str
    name: str | None = None
    description: str | None = None
    rubric_id: str | None = None
    rubric_name: str | None = None
    agent_ids: list[str] = Field(default_factory=list)
    department_ids: list[str] = Field(default_factory=list)
    use_groups: bool = False
    dynamic: bool = False
    total_runs: int = 0
    completed_runs: int = 0
    pending_runs: int = 0
    status: str = "pending"


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
    """Mapping of rubric → standard_group → standard_ids."""

    rubric_id: str
    standard_group_id: str
    standard_ids: list[str] = Field(default_factory=list)


class BenchmarkResponse(BaseModel):
    """Response with benchmark data."""

    evals: list[BenchmarkEvalItem] = Field(default_factory=list)
    rubrics: list[BenchmarkRubricItem] = Field(default_factory=list)
    departments: list[BenchmarkDepartmentItem] = Field(default_factory=list)
    agents: list[BenchmarkAgentItem] = Field(default_factory=list)
    standard_groups: list[BenchmarkStandardGroupItem] = Field(default_factory=list)
    standards: list[BenchmarkStandardItem] = Field(default_factory=list)
    rubric_standard_groups: list[BenchmarkRubricStandardGroupItem] = Field(
        default_factory=list
    )

    rubric_options: list[FilterOption] = Field(default_factory=list)
    department_options: list[FilterOption] = Field(default_factory=list)
    agent_options: list[FilterOption] = Field(default_factory=list)
    date_range_earliest: str | None = None
    date_range_latest: str | None = None

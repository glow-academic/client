"""Types for benchmark artifact."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption
from app.api.v4.views.benchmark.tests.types import BenchmarkTestViewItem
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetInstructionsV4Item,
    QGetKeysV4Item,
    QGetModelsV4Item,
    QGetPromptsV4Item,
    QGetReasoningLevelsV4Item,
    QGetTemperatureLevelsV4Item,
    QGetToolsV4Item,
    QGetVoicesV4Item,
)


class BenchmarkRequest(BaseModel):
    """Request for getting benchmark data."""

    start_date: str | None = None
    end_date: str | None = None
    department_ids: list[str] = Field(default_factory=list)


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
    """Mapping of rubric → standard_group → standard_ids."""

    rubric_id: str
    standard_group_id: str
    standard_ids: list[str] = Field(default_factory=list)


class BenchmarkResponse(BaseModel):
    """Response with benchmark data."""

    tests: list[BenchmarkTestViewItem] = Field(default_factory=list)
    total_count: int = 0
    evals: list[BenchmarkEvalItem] = Field(default_factory=list)
    departments: list[BenchmarkDepartmentItem] = Field(default_factory=list)

    department_options: list[FilterOption] = Field(default_factory=list)
    date_range_earliest: str | None = None
    date_range_latest: str | None = None


# =============================================================================
# BUNDLE endpoint types (customize flow) — Section-first pattern
# =============================================================================


class GetBenchmarkBundleRequest(BaseModel):
    """Client API request for one benchmark bundle customization payload."""

    benchmark_bundle_entry_id: UUID
    draft_id: UUID | None = None


# --- Section types (one per resource) ---


class BaseBenchmarkBundleSection(BaseModel):
    """Common metadata fields for all benchmark bundle resource sections."""

    show: bool = False
    required: bool = False
    show_ai_generate: bool = False


class BenchmarkBundleDepartmentSection(BaseBenchmarkBundleSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class BenchmarkBundleModelSection(BaseBenchmarkBundleSection):
    current: list[QGetModelsV4Item] | None = None
    resources: list[QGetModelsV4Item] | None = None


class BenchmarkBundlePromptSection(BaseBenchmarkBundleSection):
    current: list[QGetPromptsV4Item] | None = None
    resources: list[QGetPromptsV4Item] | None = None


class BenchmarkBundleInstructionSection(BaseBenchmarkBundleSection):
    current: list[QGetInstructionsV4Item] | None = None
    resources: list[QGetInstructionsV4Item] | None = None


class BenchmarkBundleVoiceSection(BaseBenchmarkBundleSection):
    current: list[QGetVoicesV4Item] | None = None
    resources: list[QGetVoicesV4Item] | None = None


class BenchmarkBundleTemperatureLevelSection(BaseBenchmarkBundleSection):
    current: list[QGetTemperatureLevelsV4Item] | None = None
    resources: list[QGetTemperatureLevelsV4Item] | None = None


class BenchmarkBundleReasoningLevelSection(BaseBenchmarkBundleSection):
    current: list[QGetReasoningLevelsV4Item] | None = None
    resources: list[QGetReasoningLevelsV4Item] | None = None


class BenchmarkBundleToolSection(BaseBenchmarkBundleSection):
    current: list[QGetToolsV4Item] | None = None
    resources: list[QGetToolsV4Item] | None = None


class BenchmarkBundleKeySection(BaseBenchmarkBundleSection):
    current: list[QGetKeysV4Item] | None = None
    resources: list[QGetKeysV4Item] | None = None


# --- GET response (section-first) ---


class GetBenchmarkBundleResponse(BaseModel):
    """Client-facing bundle response — section-first pattern."""

    benchmark_bundle_entry_id: UUID
    benchmark_id: UUID | None = None
    profile_has_access: bool = False

    # 9 section-first resources
    departments: BenchmarkBundleDepartmentSection | None = None
    models: BenchmarkBundleModelSection | None = None
    prompts: BenchmarkBundlePromptSection | None = None
    instructions: BenchmarkBundleInstructionSection | None = None
    voices: BenchmarkBundleVoiceSection | None = None
    temperature_levels: BenchmarkBundleTemperatureLevelSection | None = None
    reasoning_levels: BenchmarkBundleReasoningLevelSection | None = None
    tools: BenchmarkBundleToolSection | None = None
    keys: BenchmarkBundleKeySection | None = None

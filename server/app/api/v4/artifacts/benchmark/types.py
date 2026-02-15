"""Types for benchmark artifact."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption
from app.api.v4.views.benchmark.tests.types import BenchmarkTestViewItem
from app.api.v4.views.run.list.types import GetRunListViewResponse
from app.sql.types import (
    BenchmarkBundleMultiResourceAction,
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetInstructionsV4Item,
    QGetKeysV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetPromptsV4Item,
    QGetProvidersV4Item,
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
    draft_version: int | None = None

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

    # Config chain (settings-derived, distinct from section resources above)
    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None


# --- Websocket types (mirrors training bundle websocket pattern) ---


class BenchmarkBundleWebsocketResources(BaseModel):
    """Hydrated resources for bundle websocket — selected only."""

    departments: list[QGetDepartmentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    prompts: list[QGetPromptsV4Item] | None = None
    instructions: list[QGetInstructionsV4Item] | None = None
    voices: list[QGetVoicesV4Item] | None = None
    temperature_levels: list[QGetTemperatureLevelsV4Item] | None = None
    reasoning_levels: list[QGetReasoningLevelsV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    keys: list[QGetKeysV4Item] | None = None
    # Config chain
    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class BenchmarkBundleWebsocketViews(BaseModel):
    """Draft view for bundle websocket consumers."""

    draft_benchmark_bundle: Any | None = None
    runs: GetRunListViewResponse | None = None


class GetBenchmarkBundleWebsocketResponse(BaseModel):
    """Websocket-facing bundle response with hydrated resources."""

    views: BenchmarkBundleWebsocketViews | None = None
    resources: BenchmarkBundleWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


# =============================================================================
# DRAFT endpoint types (autosave flow) — mirrors training/types.py
# =============================================================================


class PatchBenchmarkBundleDraftApiRequest(BaseModel):
    """Request for patching a benchmark bundle draft - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    expected_version: int = 0
    department_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None
    prompt_ids: list[UUID] | None = None
    instruction_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    key_ids: list[UUID] | None = None


class PatchBenchmarkBundleDraftApiResponse(BaseModel):
    """Response for patching a benchmark bundle draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


class PatchBenchmarkBundleDraftSqlParams(BaseModel):
    """SQL parameters for patch benchmark bundle draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    departments: BenchmarkBundleMultiResourceAction
    models: BenchmarkBundleMultiResourceAction
    prompts: BenchmarkBundleMultiResourceAction
    instructions: BenchmarkBundleMultiResourceAction
    voices: BenchmarkBundleMultiResourceAction
    temperature_levels: BenchmarkBundleMultiResourceAction
    reasoning_levels: BenchmarkBundleMultiResourceAction
    tools: BenchmarkBundleMultiResourceAction
    keys: BenchmarkBundleMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls,
        request: PatchBenchmarkBundleDraftApiRequest,
        profile_id: UUID,
    ) -> "PatchBenchmarkBundleDraftSqlParams":
        def wrap(ids: list[UUID] | None) -> BenchmarkBundleMultiResourceAction:
            return BenchmarkBundleMultiResourceAction(
                resource_ids=ids, create_tool_id=None, link_tool_id=None
            )

        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            departments=wrap(request.department_ids),
            models=wrap(request.model_ids),
            prompts=wrap(request.prompt_ids),
            instructions=wrap(request.instruction_ids),
            voices=wrap(request.voice_ids),
            temperature_levels=wrap(request.temperature_level_ids),
            reasoning_levels=wrap(request.reasoning_level_ids),
            tools=wrap(request.tool_ids),
            keys=wrap(request.key_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def multi(a: BenchmarkBundleMultiResourceAction) -> tuple[Any, Any, Any]:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            multi(self.departments),
            multi(self.models),
            multi(self.prompts),
            multi(self.instructions),
            multi(self.voices),
            multi(self.temperature_levels),
            multi(self.reasoning_levels),
            multi(self.tools),
            multi(self.keys),
            self.expected_version,
        )


class PatchBenchmarkBundleDraftSqlRow(BaseModel):
    """SQL row for patch benchmark bundle draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None

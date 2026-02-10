"""Handcrafted types for eval artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftEvalViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetGroupPositionsV4Item,
    QGetGroupRubricsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProvidersV4Item,
    QGetRunPositionsV4Item,
    QGetRunRubricsV4Item,
    QGetToolsV4Item,
)

# ========== Eval-specific resource types ==========


class EvalAgentItem(BaseModel):
    """Eval agent item (from eval_agents resource endpoint)."""

    id: UUID
    name: str | None = None
    description: str | None = None
    roles: list[str] | None = None
    generated: bool = False


class EvalRubricItem(BaseModel):
    """Eval rubric item (from rubrics resource endpoint)."""

    id: UUID
    name: str | None = None
    description: str | None = None
    agent_role: str | None = None
    generated: bool = False


class EvalRunRubricMapping(BaseModel):
    """Maps a model run to its assigned rubric IDs."""

    run_id: UUID
    rubric_ids: list[UUID] | None = None


class EvalGroupRubricMapping(BaseModel):
    """Maps a group to its assigned rubric IDs."""

    group_id: UUID
    rubric_ids: list[UUID] | None = None


class EvalAvailableModelRun(BaseModel):
    """Available model run for eval selection."""

    model_run_id: UUID
    created_at: datetime | None = None
    model_id: UUID | None = None
    model_name: str | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None
    agent_id: UUID | None = None
    agent_name: str | None = None
    persona_id: UUID | None = None
    persona_name: str | None = None
    actor_type: str | None = None


class EvalAvailableGroup(BaseModel):
    """Available group for eval selection."""

    group_id: UUID
    name: str | None = None
    description: str | None = None
    created_at: datetime | None = None
    member_count: int | None = None


class EvalFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active", "dynamic", "groups"
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


# ========== GET Endpoint Types ==========


class BaseEvalSection(BaseModel):
    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class EvalNameSection(BaseEvalSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class EvalDescriptionSection(BaseEvalSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class EvalFlagSection(BaseEvalSection):
    resource: EvalFlagConfig | None = None
    resources: list[EvalFlagConfig] | None = None


class EvalDepartmentSection(BaseEvalSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class EvalAgentSection(BaseEvalSection):
    current: list[EvalAgentItem] | None = None
    resources: list[EvalAgentItem] | None = None


class EvalRubricSection(BaseEvalSection):
    current: list[EvalRubricItem] | None = None
    resources: list[EvalRubricItem] | None = None


class EvalRunSection(BaseEvalSection):
    current: list[EvalAvailableModelRun] | None = None
    resources: list[EvalAvailableModelRun] | None = None


class EvalGroupSection(BaseEvalSection):
    current: list[EvalAvailableGroup] | None = None
    resources: list[EvalAvailableGroup] | None = None


class GetEvalApiRequest(BaseModel):
    """Request model for get eval endpoint."""

    eval_id: UUID | None = None
    draft_id: UUID | None = None
    agent_search: str | None = None
    group_search: str | None = None
    available_model_runs_search: str | None = None
    available_model_runs_agent_ids: list[UUID] | None = None
    available_model_runs_page: int | None = 1
    available_model_runs_page_size: int | None = 50


class GetEvalApiResponse(BaseModel):
    """Response model for get eval endpoint."""

    actor_name: str | None = None
    eval_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: EvalNameSection | None = None
    descriptions: EvalDescriptionSection | None = None
    active_flags: EvalFlagSection | None = None
    dynamic_flags: EvalFlagSection | None = None
    groups_flags: EvalFlagSection | None = None
    departments: EvalDepartmentSection | None = None
    agents: EvalAgentSection | None = None
    rubrics: EvalRubricSection | None = None
    runs: EvalRunSection | None = None
    groups: EvalGroupSection | None = None

    run_rubrics: list[EvalRunRubricMapping] | None = None
    group_rubrics: list[EvalGroupRubricMapping] | None = None

    available_model_runs: list[EvalAvailableModelRun] | None = None
    available_model_runs_total_count: int | None = None
    available_model_runs_page: int | None = None
    available_model_runs_page_size: int | None = None
    available_model_runs_total_pages: int | None = None

    available_groups: list[EvalAvailableGroup] | None = None


class EvalWebsocketViews(BaseModel):
    draft_eval: DraftEvalViewItem | None = None


class EvalWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[EvalFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    eval_agents: list[EvalAgentItem] | None = None
    rubrics: list[EvalRubricItem] | None = None
    run_positions: list[QGetRunPositionsV4Item] | None = None
    group_positions: list[QGetGroupPositionsV4Item] | None = None
    run_rubrics: list[QGetRunRubricsV4Item] | None = None
    group_rubrics: list[QGetGroupRubricsV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetEvalWebsocketResponse(BaseModel):
    views: EvalWebsocketViews | None = None
    resources: EvalWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


# ========== List Endpoint Types ==========


class ListEvalApiEval(BaseModel):
    """Eval type for list endpoint with computed permissions."""

    eval_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    agent_ids: list[UUID] | None = None
    is_inactive: bool | None = None
    is_dynamic: bool | None = None
    use_groups: bool | None = None
    num_runs: int | None = None
    num_groups: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListEvalApiDepartment(BaseModel):
    """Department type for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListEvalApiResponse(BaseModel):
    """Response model for list eval endpoint with computed permissions."""

    actor_name: str | None = None
    evals: list[ListEvalApiEval] | None = None
    departments: list[ListEvalApiDepartment] | None = None
    total_count: int | None = None
    user_role: str | None = None


# ========== Save Endpoint Types ==========


class EvalResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class EvalMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveEvalApiRequest(BaseModel):
    """Request model for save eval endpoint (nested section actions)."""

    group_id: UUID
    input_eval_id: UUID | None = None

    names: EvalResourceAction
    descriptions: EvalResourceAction
    flags: EvalMultiResourceAction
    departments: EvalMultiResourceAction
    agents: EvalMultiResourceAction
    runs: EvalMultiResourceAction
    groups: EvalMultiResourceAction
    run_positions: EvalMultiResourceAction | None = None
    group_positions: EvalMultiResourceAction | None = None

    # Scoped rubric mappings (target -> rubric ids)
    run_rubrics: list[EvalRunRubricMapping] | None = None
    group_rubrics: list[EvalGroupRubricMapping] | None = None


class SaveEvalApiResponse(BaseModel):
    """Response model for save eval endpoint."""

    success: bool
    eval_id: UUID
    message: str


class SaveEvalSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_eval_id: UUID | None = None

    name_id: UUID
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None
    run_position_ids: list[UUID] | None = None
    group_position_ids: list[UUID] | None = None
    run_rubrics: list[EvalRunRubricMapping] | None = None
    group_rubrics: list[EvalGroupRubricMapping] | None = None

    @classmethod
    def from_request(
        cls, request: SaveEvalApiRequest, profile_id: UUID
    ) -> SaveEvalSqlParams:
        name_id = request.names.resource_id
        if not name_id:
            raise ValueError("Name resource is required")
        return cls(
            profile_id=profile_id,
            group_id=request.group_id,
            input_eval_id=request.input_eval_id,
            name_id=name_id,
            description_id=request.descriptions.resource_id,
            flag_ids=request.flags.resource_ids,
            department_ids=request.departments.resource_ids,
            agent_ids=request.agents.resource_ids,
            model_run_ids=request.runs.resource_ids,
            group_ids=request.groups.resource_ids,
            run_position_ids=(
                request.run_positions.resource_ids if request.run_positions else None
            ),
            group_position_ids=(
                request.group_positions.resource_ids
                if request.group_positions
                else None
            ),
            run_rubrics=request.run_rubrics,
            group_rubrics=request.group_rubrics,
        )

    def to_tuple(self) -> tuple:
        run_rubrics_tuples = [
            (conn.run_id, conn.rubric_ids) for conn in (self.run_rubrics or [])
        ]
        group_rubrics_tuples = [
            (conn.group_id, conn.rubric_ids) for conn in (self.group_rubrics or [])
        ]
        return (
            self.profile_id,
            self.group_id,
            self.input_eval_id,
            self.name_id,
            self.description_id,
            self.flag_ids,
            self.department_ids,
            self.agent_ids,
            self.model_run_ids,
            self.group_ids,
            self.run_position_ids,
            self.group_position_ids,
            run_rubrics_tuples,
            group_rubrics_tuples,
        )


class SaveEvalSqlRow(BaseModel):
    """SQL row for save eval."""

    eval_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteEvalApiRequest(BaseModel):
    """Request model for delete eval endpoint."""

    eval_id: UUID


class DeleteEvalApiResponse(BaseModel):
    """Response model for delete eval endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateEvalApiRequest(BaseModel):
    """Request model for duplicate eval endpoint."""

    eval_id: UUID


class DuplicateEvalApiResponse(BaseModel):
    """Response model for duplicate eval endpoint."""

    success: bool
    eval_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchEvalDraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: EvalResourceAction | None = None
    descriptions: EvalResourceAction | None = None
    flags: EvalMultiResourceAction | None = None
    departments: EvalMultiResourceAction | None = None
    agents: EvalMultiResourceAction | None = None
    runs: EvalMultiResourceAction | None = None
    groups: EvalMultiResourceAction | None = None
    run_positions: EvalMultiResourceAction | None = None
    group_positions: EvalMultiResourceAction | None = None
    expected_version: int = 0


class PatchEvalDraftApiResponse(BaseModel):
    """Response model for patch eval draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchEvalDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None
    run_position_ids: list[UUID] | None = None
    group_position_ids: list[UUID] | None = None
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchEvalDraftApiRequest, profile_id: UUID
    ) -> PatchEvalDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            name_id=request.names.resource_id if request.names else None,
            description_id=request.descriptions.resource_id
            if request.descriptions
            else None,
            flag_ids=request.flags.resource_ids if request.flags else None,
            department_ids=request.departments.resource_ids
            if request.departments
            else None,
            agent_ids=request.agents.resource_ids if request.agents else None,
            model_run_ids=request.runs.resource_ids if request.runs else None,
            group_ids=request.groups.resource_ids if request.groups else None,
            run_position_ids=request.run_positions.resource_ids
            if request.run_positions
            else None,
            group_position_ids=request.group_positions.resource_ids
            if request.group_positions
            else None,
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            self.name_id,
            self.description_id,
            self.flag_ids,
            self.department_ids,
            self.agent_ids,
            self.model_run_ids,
            self.group_ids,
            self.run_position_ids,
            self.group_position_ids,
            self.expected_version,
        )


class PatchEvalDraftSqlRow(BaseModel):
    """SQL row for patch eval draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None

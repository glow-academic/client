"""Handcrafted types for eval artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


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
    domain_id: UUID | None = None
    generated: bool | None = None


# ========== GET Endpoint Types ==========


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

    # Required fields
    actor_name: str | None = None
    eval_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Selected resource IDs (for client form state initialization)
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    dynamic_flag_id: UUID | None = None
    groups_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None

    # Per-resource group IDs
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    eval_agents_group_id: UUID | None = None
    rubrics_group_id: UUID | None = None

    # Single-select resources: name
    show_name: bool | None = None
    name_domain_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    name_show_ai_generate: bool | None = None

    # Single-select resources: description
    show_description: bool | None = None
    description_domain_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    description_show_ai_generate: bool | None = None

    # Flags: active
    show_active_flag: bool | None = None
    active_flag_domain_id: UUID | None = None
    active_flag_required: bool | None = None
    active_flag_show_ai_generate: bool | None = None

    # Flags: dynamic
    show_dynamic_flag: bool | None = None
    dynamic_flag_domain_id: UUID | None = None
    dynamic_flag_required: bool | None = None
    dynamic_flag_show_ai_generate: bool | None = None

    # Flags: groups
    show_groups_flag: bool | None = None
    groups_flag_domain_id: UUID | None = None
    groups_flag_required: bool | None = None
    groups_flag_show_ai_generate: bool | None = None

    # Multi-select resources: departments
    show_departments: bool | None = None
    departments_domain_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments_show_ai_generate: bool | None = None

    # Multi-select resources: eval_agents
    show_agents: bool | None = None
    agents_domain_id: UUID | None = None
    agents_required: bool | None = None
    agent_suggestions: list[UUID] | None = None
    agents_show_ai_generate: bool | None = None

    # Multi-select resources: rubrics
    show_rubrics: bool | None = None
    rubrics_domain_id: UUID | None = None
    rubrics_required: bool | None = None
    rubric_suggestions: list[UUID] | None = None
    rubrics_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    agents_link_tool_id: UUID | None = None
    rubrics_link_tool_id: UUID | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Resources payload
    resources: EvalResources | None = None

    # Eval-specific fields
    run_rubrics: list[EvalRunRubricMapping] | None = None
    group_rubrics: list[EvalGroupRubricMapping] | None = None

    # Available model runs (paginated)
    available_model_runs: list[EvalAvailableModelRun] | None = None
    available_model_runs_total_count: int | None = None
    available_model_runs_page: int | None = None
    available_model_runs_page_size: int | None = None
    available_model_runs_total_pages: int | None = None

    # Available groups
    available_groups: list[EvalAvailableGroup] | None = None


class GetEvalWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_eval_websocket).

    Contains only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID
    - Resources (for Jinja template context)
    """

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    agents_domain_id: UUID | None = None
    rubrics_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id)
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: EvalResources | None = None


class EvalResourceBucket(BaseModel):
    """Generic resources bucket with full objects."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[EvalFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    eval_agents: list[EvalAgentItem] | None = None
    rubrics: list[EvalRubricItem] | None = None


class EvalResources(BaseModel):
    """Full resources + current selections."""

    resources: EvalResourceBucket | None = None
    current: EvalResourceBucket | None = None


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


class SaveEvalApiRequest(BaseModel):
    """Request model for save eval endpoint - accepts form data directly."""

    # Context
    group_id: UUID
    input_eval_id: UUID | None = None

    # Required single-select resources
    name_id: UUID

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    dynamic_flag_id: UUID | None = None
    groups_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None

    # Rubric mappings
    run_rubrics: list[EvalRunRubricMapping] | None = None
    group_rubrics: list[EvalGroupRubricMapping] | None = None


class SaveEvalApiResponse(BaseModel):
    """Response model for save eval endpoint."""

    success: bool
    eval_id: UUID
    message: str


class SaveEvalSqlParams(BaseModel):
    """SQL parameters for save eval."""

    profile_id: UUID
    group_id: UUID
    input_eval_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    dynamic_flag_id: UUID | None = None
    groups_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None
    run_rubrics: list[EvalRunRubricMapping] | None = None
    group_rubrics: list[EvalGroupRubricMapping] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_eval_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.dynamic_flag_id,
            self.groups_flag_id,
            self.department_ids,
            self.agent_ids,
            self.rubric_ids,
            self.model_run_ids,
            self.group_ids,
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
    """Request model for patch eval draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchEvalDraftApiResponse(BaseModel):
    """Response model for patch eval draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchEvalDraftSqlParams(BaseModel):
    """SQL parameters for patch eval draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None
    model_run_ids: list[UUID] | None = None
    group_ids: list[UUID] | None = None
    expected_version: int = 0

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.input_draft_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.department_ids,
            self.agent_ids,
            self.model_run_ids,
            self.group_ids,
            self.expected_version,
        )


class PatchEvalDraftSqlRow(BaseModel):
    """SQL row for patch eval draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None

"""Handcrafted types for rubric GET endpoint."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetPointsV4Item,
    QGetStandardGroupsV4Item,
    QGetStandardsV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class RubricFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None
    generated: bool | None = None


class GetRubricApiRequest(BaseModel):
    """Request model for get rubric endpoint."""

    rubric_id: UUID | None = None
    draft_id: UUID | None = None
    description_search: str | None = None
    standard_group_search: str | None = None


class GetRubricApiResponse(BaseModel):
    """Response model for get rubric endpoint."""

    # Required fields
    actor_name: str | None = None
    rubric_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    points_group_id: UUID | None = None
    pass_points_group_id: UUID | None = None
    standard_groups_group_id: UUID | None = None
    standards_group_id: UUID | None = None

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

    # Single-select resources: flag
    show_flag: bool | None = None
    flag_domain_id: UUID | None = None
    flag_required: bool | None = None
    flag_show_ai_generate: bool | None = None

    # Multi-select resources: departments
    show_departments: bool | None = None
    departments_domain_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments_show_ai_generate: bool | None = None

    # Single-select resources: points (total)
    show_points: bool | None = None
    points_domain_id: UUID | None = None
    points_required: bool | None = None
    points_suggestions: list[UUID] | None = None
    points_show_ai_generate: bool | None = None

    # Single-select resources: pass_points
    show_pass_points: bool | None = None
    pass_points_domain_id: UUID | None = None
    pass_points_required: bool | None = None
    pass_points_suggestions: list[UUID] | None = None
    pass_points_show_ai_generate: bool | None = None

    # Multi-select resources: standard_groups
    show_standard_groups: bool | None = None
    standard_groups_domain_id: UUID | None = None
    standard_groups_required: bool | None = None
    standard_group_suggestions: list[UUID] | None = None
    standard_groups_show_ai_generate: bool | None = None

    # Multi-select resources: standards
    show_standards: bool | None = None
    standards_domain_id: UUID | None = None
    standards_required: bool | None = None
    standard_suggestions: list[UUID] | None = None
    standards_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    points_create_tool_id: UUID | None = None
    pass_points_create_tool_id: UUID | None = None
    standard_groups_create_tool_id: UUID | None = None
    standards_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    points_link_tool_id: UUID | None = None
    pass_points_link_tool_id: UUID | None = None
    standard_groups_link_tool_id: UUID | None = None
    standards_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: RubricResources | None = None


class GetRubricWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_rubric_websocket)."""

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    points_domain_id: UUID | None = None
    pass_points_domain_id: UUID | None = None
    standard_groups_domain_id: UUID | None = None
    standards_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: RubricResources | None = None


class RubricResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[RubricFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    points: list[QGetPointsV4Item] | None = None
    pass_points: list[QGetPointsV4Item] | None = None
    standard_groups: list[QGetStandardGroupsV4Item] | None = None
    standards: list[QGetStandardsV4Item] | None = None


class RubricResources(BaseModel):
    """Full resources + current selections."""

    resources: RubricResourceBucket | None = None
    current: RubricResourceBucket | None = None


# ========== Save Endpoint Types ==========


class SaveRubricApiRequest(BaseModel):
    """Request model for save rubric endpoint - accepts form data directly."""

    group_id: UUID
    input_rubric_id: UUID | None = None

    # Required single-select resources
    name_id: UUID

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    total_points_id: UUID | None = None
    pass_points_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class SaveRubricApiResponse(BaseModel):
    """Response model for save rubric endpoint."""

    success: bool
    rubric_id: UUID
    message: str


class SaveRubricSqlParams(BaseModel):
    """SQL parameters for save rubric - accepts form data directly."""

    profile_id: UUID
    group_id: UUID
    input_rubric_id: UUID | None = None

    name_id: UUID
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    total_points_id: UUID | None = None
    pass_points_id: UUID | None = None

    department_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_rubric_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.total_points_id,
            self.pass_points_id,
            self.department_ids,
            self.standard_group_ids,
            self.standard_ids,
        )


class SaveRubricSqlRow(BaseModel):
    """SQL row for save rubric."""

    rubric_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteRubricApiRequest(BaseModel):
    """Request model for delete rubric endpoint."""

    rubric_id: UUID


class DeleteRubricApiResponse(BaseModel):
    """Response model for delete rubric endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateRubricApiRequest(BaseModel):
    """Request model for duplicate rubric endpoint."""

    rubric_id: UUID


class DuplicateRubricApiResponse(BaseModel):
    """Response model for duplicate rubric endpoint."""

    success: bool
    rubric_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchRubricDraftApiRequest(BaseModel):
    """Request model for patch rubric draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    total_points_id: UUID | None = None
    pass_points_id: UUID | None = None
    department_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchRubricDraftApiResponse(BaseModel):
    """Response model for patch rubric draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str

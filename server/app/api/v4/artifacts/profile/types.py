"""Handcrafted types for profile artifact endpoints."""

from __future__ import annotations

import datetime as dt
from datetime import date as date_type
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.resources.cohorts.types import QGetCohortsV4Item
from app.api.v4.views.drafts.types import DraftProfileViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetEmailsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProvidersV4Item,
    QGetRequestLimitsV4Item,
    QGetToolsV4Item,
)


class ProfileFlagConfig(BaseModel):
    """Enriched profile flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class BaseResourceSection(BaseModel):
    """Common metadata fields for all profile resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ProfileNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class ProfileRequestLimitSection(BaseResourceSection):
    resource: QGetRequestLimitsV4Item | None = None
    resources: list[QGetRequestLimitsV4Item] | None = None


class ProfileFlagSection(BaseResourceSection):
    current: ProfileFlagConfig | None = None
    resources: list[ProfileFlagConfig] | None = None


class ProfileEmailSection(BaseResourceSection):
    current: list[QGetEmailsV4Item] | None = None
    resources: list[QGetEmailsV4Item] | None = None


class ProfileDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class ProfileCohortSection(BaseResourceSection):
    current: list[QGetCohortsV4Item] | None = None
    resources: list[QGetCohortsV4Item] | None = None


class ProfileRoleResource(BaseModel):
    """Role resource for profile."""

    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class GetProfileApiRequest(BaseModel):
    target_profile_id: UUID | None = None
    draft_id: UUID | None = None


class GetProfileApiResponse(BaseModel):
    actor_name: str | None = None
    profile_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None
    profile_id: UUID | None = None

    role: str | None = None
    role_options: list[str] | None = None
    roles: list[ProfileRoleResource] | None = None

    basic_show_ai_generate: bool | None = None
    general_show_ai_generate: bool | None = None

    names: ProfileNameSection | None = None
    emails: ProfileEmailSection | None = None
    request_limits: ProfileRequestLimitSection | None = None
    flags: ProfileFlagSection | None = None
    departments: ProfileDepartmentSection | None = None
    cohorts: ProfileCohortSection | None = None


class ProfileWebsocketViews(BaseModel):
    draft_profile: DraftProfileViewItem | None = None


class ProfileWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    emails: list[QGetEmailsV4Item] | None = None
    request_limits: list[QGetRequestLimitsV4Item] | None = None
    flags: list[ProfileFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    cohorts: list[QGetCohortsV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetProfileWebsocketResponse(BaseModel):
    views: ProfileWebsocketViews | None = None
    resources: ProfileWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class SaveProfileRouteApiRequest(BaseModel):
    """Save payload with persona-style nested resource actions."""

    input_profile_id: UUID | None = None
    group_id: UUID | None = None
    role: str | None = None
    names: ProfileResourceAction
    flags: ProfileResourceAction
    request_limits: ProfileResourceAction
    emails: ProfileMultiResourceAction
    departments: ProfileMultiResourceAction
    cohorts: ProfileMultiResourceAction
    expected_version: int = 0


class SaveProfileRouteApiResponse(BaseModel):
    success: bool
    profile_id: UUID
    message: str


class SaveProfileSqlParams(BaseModel):
    draft_id: UUID
    actor_profile_id: UUID
    input_profile_id: UUID | None = None

    def to_tuple(self) -> tuple:
        return (
            self.draft_id,
            self.actor_profile_id,
            self.input_profile_id,
        )


class SaveProfileSqlRow(BaseModel):
    profile_id: UUID | None = None
    actor_name: str | None = None


class DeleteProfileApiRequest(BaseModel):
    target_profile_id: UUID


class DeleteProfileApiResponse(BaseModel):
    success: bool
    message: str


class DuplicateProfileApiRequest(BaseModel):
    target_profile_id: UUID


class DuplicateProfileApiResponse(BaseModel):
    success: bool
    profile_id: UUID
    message: str


class ProfileResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ProfileMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class PatchProfileDraftApiRequest(BaseModel):
    """Request model for patch profile draft endpoint - nested resource actions."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    role: str | None = None
    names: ProfileResourceAction | None = None
    flags: ProfileResourceAction | None = None
    request_limits: ProfileResourceAction | None = None
    emails: ProfileMultiResourceAction | None = None
    departments: ProfileMultiResourceAction | None = None
    cohorts: ProfileMultiResourceAction | None = None
    expected_version: int = 0


class PatchProfileDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchProfileDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    role: str | None = None
    names: ProfileResourceAction
    flags: ProfileResourceAction
    request_limits: ProfileResourceAction
    emails: ProfileMultiResourceAction
    departments: ProfileMultiResourceAction
    cohorts: ProfileMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchProfileDraftApiRequest, profile_id: UUID
    ) -> PatchProfileDraftSqlParams:
        empty_single = ProfileResourceAction()
        empty_multi = ProfileMultiResourceAction()
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            role=request.role,
            names=request.names or empty_single,
            flags=request.flags or empty_single,
            request_limits=request.request_limits or empty_single,
            emails=request.emails or empty_multi,
            departments=request.departments or empty_multi,
            cohorts=request.cohorts or empty_multi,
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: ProfileResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ProfileMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.flags),
            single(self.request_limits),
            multi(self.departments),
            multi(self.emails),
            multi(self.cohorts),
            self.role,
            self.expected_version,
        )


class PatchProfileDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# ========== List Endpoint Types ==========


class ListStaffApiStaff(BaseModel):
    """Staff member type for list endpoint with computed permissions."""

    profile_id: UUID | None = None
    emails: list[str] | None = None
    primary_email: str | None = None
    name: str | None = None
    role: str | None = None
    initials: str | None = None
    active: bool | None = None
    last_active: dt.datetime | None = None
    cohort_ids: list[str] | None = None
    department_ids: list[str] | None = None
    primary_department_id: str | None = None
    requests_per_day: int | None = None
    total_requests: int | None = None
    requests_in_last_day: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListStaffApiCohort(BaseModel):
    """Cohort type for list endpoint filter options."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListStaffApiDepartment(BaseModel):
    """Department type for list endpoint filter options."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListStaffApiTrendData(BaseModel):
    """Trend data point for staff analytics charts."""

    date: date_type | None = None
    value: float | None = None
    count: int | None = None


class ListStaffApiResponse(BaseModel):
    """Response model for staff list endpoint with computed permissions."""

    actor_name: str | None = None
    staff: list[ListStaffApiStaff] | None = None
    cohorts: list[ListStaffApiCohort] | None = None
    departments: list[ListStaffApiDepartment] | None = None
    trend_data_active: list[ListStaffApiTrendData] | None = None
    trend_data_admin: list[ListStaffApiTrendData] | None = None
    trend_data_instructional: list[ListStaffApiTrendData] | None = None
    trend_data_member: list[ListStaffApiTrendData] | None = None
    trend_data_total_requests: list[ListStaffApiTrendData] | None = None
    role_options: list[str] | None = None
    last_active_options: list[str] | None = None
    total_count: int | None = None

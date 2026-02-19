"""Handcrafted types for profile artifact endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.resources.cohorts.types import QGetCohortsV4Item
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.api.v4.views.run.list.types import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetEmailsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProfileDraftsEntriesV4Item,
    QGetProfilesV4Item,
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
    draft_profile: QGetProfileDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


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
    config_profile: list[QGetProfilesV4Item] | None = None


class GetProfileWebsocketResponse(BaseModel):
    views: ProfileWebsocketViews | None = None
    resources: ProfileWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class SaveProfileRouteApiRequest(BaseModel):
    """Save payload with flat resource IDs."""

    input_profile_id: UUID | None = None
    role: str | None = None
    name_id: UUID
    flag_id: UUID | None = None
    request_limit_id: UUID | None = None
    email_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    expected_version: int = 0


class SaveProfileRouteApiResponse(BaseModel):
    profile_id: UUID
    actor_name: str | None = None


class SaveProfileSqlParams(BaseModel):
    """SQL parameters for save profile - builds composites from flat IDs."""

    profile_id: UUID
    input_profile_id: UUID | None = None
    group_id: UUID | None = None
    role: str | None = None
    names: ProfileResourceAction
    flags: ProfileResourceAction
    request_limits: ProfileResourceAction
    emails: ProfileMultiResourceAction
    departments: ProfileMultiResourceAction
    cohorts: ProfileMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveProfileRouteApiRequest,
        profile_id: UUID,
        group_id: UUID | None = None,
    ) -> SaveProfileSqlParams:
        return cls(
            profile_id=profile_id,
            input_profile_id=request.input_profile_id,
            group_id=group_id,
            role=request.role,
            names=ProfileResourceAction(resource_id=request.name_id),
            flags=ProfileResourceAction(resource_id=request.flag_id),
            request_limits=ProfileResourceAction(resource_id=request.request_limit_id),
            emails=ProfileMultiResourceAction(resource_ids=request.email_ids),
            departments=ProfileMultiResourceAction(resource_ids=request.department_ids),
            cohorts=ProfileMultiResourceAction(resource_ids=request.cohort_ids),
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""

        def single(a: ProfileResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ProfileMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_profile_id,
            self.group_id,
            self.role,
            single(self.names),
            single(self.flags),
            single(self.request_limits),
            multi(self.emails),
            multi(self.departments),
            multi(self.cohorts),
        )


class SaveProfileSqlRow(BaseModel):
    """SQL row for save profile."""

    out_profile_id: UUID | None = None
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
    """Request model for patch profile draft endpoint - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    role: str | None = None
    name_id: UUID | None = None
    flag_id: UUID | None = None
    request_limit_id: UUID | None = None
    email_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
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
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            role=request.role,
            names=ProfileResourceAction(resource_id=request.name_id),
            flags=ProfileResourceAction(resource_id=request.flag_id),
            request_limits=ProfileResourceAction(resource_id=request.request_limit_id),
            emails=ProfileMultiResourceAction(resource_ids=request.email_ids),
            departments=ProfileMultiResourceAction(resource_ids=request.department_ids),
            cohorts=ProfileMultiResourceAction(resource_ids=request.cohort_ids),
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
    cohort_ids: list[str] | None = None
    department_ids: list[str] | None = None
    primary_department_id: str | None = None
    requests_per_day: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListStaffApiResponse(BaseModel):
    """Response model for staff list endpoint with computed permissions."""

    actor_name: str | None = None
    staff: list[ListStaffApiStaff] | None = None
    cohort_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    role_filter: ListFilterSection | None = None
    total_count: int | None = None

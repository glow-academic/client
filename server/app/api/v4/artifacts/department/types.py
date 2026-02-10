"""Handcrafted types for department artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftDepartmentViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDescriptionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProvidersV4Item,
    QGetSettingsV4Item,
    QGetToolsV4Item,
)


class DepartmentFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class BaseResourceSection(BaseModel):
    """Common metadata fields for all department resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class DepartmentNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class DepartmentDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class DepartmentFlagSection(BaseResourceSection):
    current: list[DepartmentFlagConfig] | None = None
    resources: list[DepartmentFlagConfig] | None = None


class DepartmentSettingSection(BaseResourceSection):
    current: list[QGetSettingsV4Item] | None = None
    resources: list[QGetSettingsV4Item] | None = None


class GetDepartmentApiRequest(BaseModel):
    department_id: UUID | None = None
    draft_id: UUID | None = None


class GetDepartmentApiResponse(BaseModel):
    actor_name: str | None = None
    department_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: DepartmentNameSection | None = None
    descriptions: DepartmentDescriptionSection | None = None
    flags: DepartmentFlagSection | None = None
    settings: DepartmentSettingSection | None = None


class DepartmentWebsocketViews(BaseModel):
    draft_department: DraftDepartmentViewItem | None = None


class DepartmentWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[DepartmentFlagConfig] | None = None
    settings: list[QGetSettingsV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetDepartmentWebsocketResponse(BaseModel):
    views: DepartmentWebsocketViews | None = None
    resources: DepartmentWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class DepartmentResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class DepartmentMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveDepartmentApiRequest(BaseModel):
    group_id: UUID
    input_department_id: UUID | None = None
    names: DepartmentResourceAction
    descriptions: DepartmentResourceAction
    flags: DepartmentResourceAction
    settings: DepartmentMultiResourceAction


class SaveDepartmentApiResponse(BaseModel):
    success: bool
    department_id: UUID
    message: str


class SaveDepartmentSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_department_id: UUID | None = None
    names: DepartmentResourceAction
    descriptions: DepartmentResourceAction
    flags: DepartmentResourceAction
    settings: DepartmentMultiResourceAction

    @classmethod
    def from_request(
        cls, request: SaveDepartmentApiRequest, profile_id: UUID
    ) -> SaveDepartmentSqlParams:
        return cls(profile_id=profile_id, **request.model_dump())

    def to_tuple(self) -> tuple:
        def single(a: DepartmentResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: DepartmentMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_department_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.settings),
        )


class SaveDepartmentSqlRow(BaseModel):
    department_id: UUID | None = None
    actor_name: str | None = None


class DeleteDepartmentApiRequest(BaseModel):
    department_id: UUID


class DeleteDepartmentApiResponse(BaseModel):
    success: bool
    message: str


class DuplicateDepartmentApiRequest(BaseModel):
    department_id: UUID


class DuplicateDepartmentApiResponse(BaseModel):
    success: bool
    department_id: UUID
    message: str


class PatchDepartmentDraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: DepartmentResourceAction | None = None
    descriptions: DepartmentResourceAction | None = None
    flags: DepartmentResourceAction | None = None
    settings: DepartmentMultiResourceAction | None = None
    expected_version: int = 0


class PatchDepartmentDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchDepartmentDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: DepartmentResourceAction
    descriptions: DepartmentResourceAction
    flags: DepartmentResourceAction
    settings: DepartmentMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchDepartmentDraftApiRequest, profile_id: UUID
    ) -> PatchDepartmentDraftSqlParams:
        empty_single = DepartmentResourceAction()
        empty_multi = DepartmentMultiResourceAction()
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=request.names or empty_single,
            descriptions=request.descriptions or empty_single,
            flags=request.flags or empty_single,
            settings=request.settings or empty_multi,
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: DepartmentResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: DepartmentMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.settings),
            self.expected_version,
        )


class PatchDepartmentDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


class ListDepartmentApiDepartment(BaseModel):
    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    staff_count: int | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListDepartmentApiCohort(BaseModel):
    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListDepartmentApiProfile(BaseModel):
    profile_id: UUID | None = None
    name: str | None = None
    count: int | None = None


class ListDepartmentApiResponse(BaseModel):
    actor_name: str | None = None
    departments: list[ListDepartmentApiDepartment] | None = None
    cohorts: list[ListDepartmentApiCohort] | None = None
    profiles: list[ListDepartmentApiProfile] | None = None
    total_count: int | None = None

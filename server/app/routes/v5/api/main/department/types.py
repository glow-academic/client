"""Handcrafted types for department artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.entries.runs.search import GetRunListViewResponse
from app.routes.v5.api.types import BaseResourceSection
from app.sql.types import (
    QGetDepartmentDraftsEntriesV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetSettingsV4Item,
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
    group_id: UUID | None = None


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


class DepartmentWebsocketEntries(BaseModel):
    draft_department: QGetDepartmentDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class DepartmentWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[DepartmentFlagConfig] | None = None
    settings: list[QGetSettingsV4Item] | None = None


class GetDepartmentWebsocketResponse(InternalResponseBase):
    entries: DepartmentWebsocketEntries | None = None
    resources: DepartmentWebsocketResources


class DepartmentResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class DepartmentMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveDepartmentApiRequest(BaseModel):
    input_department_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_id: UUID | None = None
    settings_ids: list[UUID] | None = None


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
        cls,
        request: SaveDepartmentApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveDepartmentSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_department_id=request.input_department_id,
            names=DepartmentResourceAction(resource_id=request.name_id),
            descriptions=DepartmentResourceAction(resource_id=request.description_id),
            flags=DepartmentResourceAction(resource_id=request.flag_id),
            settings=DepartmentMultiResourceAction(resource_ids=request.settings_ids),
        )

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
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    settings_ids: list[UUID] | None = None
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
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=DepartmentResourceAction(resource_id=request.name_id),
            descriptions=DepartmentResourceAction(resource_id=request.description_id),
            flags=DepartmentResourceAction(resource_id=request.flag_id),
            settings=DepartmentMultiResourceAction(resource_ids=request.settings_ids),
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


class ListDepartmentApiResponse(BaseModel):
    actor_name: str | None = None
    departments: list[ListDepartmentApiDepartment] | None = None
    total_count: int | None = None

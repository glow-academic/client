"""Handcrafted types for field artifact endpoints (section-first parity)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFieldDraftsEntriesV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetParametersV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)


class FieldFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class FieldNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class FieldDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class FieldFlagSection(BaseResourceSection):
    resource: FieldFlagConfig | None = None
    resources: list[FieldFlagConfig] | None = None


class FieldDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class FieldConditionalParameterSection(BaseResourceSection):
    current: list[QGetParametersV4Item] | None = None
    resources: list[QGetParametersV4Item] | None = None


class GetFieldApiRequest(BaseModel):
    """Request model for get field endpoint."""

    field_id: UUID | None = None
    draft_id: UUID | None = None
    description_search: str | None = None
    conditional_parameter_search: str | None = None
    conditional_parameter_show_selected: bool | None = None


class GetFieldApiResponse(BaseModel):
    """Section-first client response for get field endpoint."""

    actor_name: str | None = None
    field_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: FieldNameSection | None = None
    descriptions: FieldDescriptionSection | None = None
    flags: FieldFlagSection | None = None
    departments: FieldDepartmentSection | None = None
    conditional_parameters: FieldConditionalParameterSection | None = None


class FieldWebsocketViews(BaseModel):
    draft_field: QGetFieldDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class FieldWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[FieldFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    conditional_parameters: list[QGetParametersV4Item] | None = None
    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_args: list[QGetArgsV4Item] | None = None
    config_args_outputs: list[QGetArgsOutputsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class GetFieldWebsocketResponse(BaseModel):
    views: FieldWebsocketViews | None = None
    resources: FieldWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


@dataclass
class FieldInternalData:
    actor_name: str | None
    field_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    agent_ids: dict[str, UUID | None]
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]
    suggestions_map: dict[str, list[UUID]]
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool

    selected_names: list[QGetNamesV4Item] | None
    all_names: list[QGetNamesV4Item] | None
    selected_descriptions: list[QGetDescriptionsV4Item] | None
    all_descriptions: list[QGetDescriptionsV4Item] | None
    selected_flags: list[FieldFlagConfig] | None
    all_flags: list[FieldFlagConfig] | None
    selected_departments: list[QGetDepartmentsV4Item] | None
    all_departments: list[QGetDepartmentsV4Item] | None
    selected_conditional_parameters: list[QGetParametersV4Item] | None
    all_conditional_parameters: list[QGetParametersV4Item] | None

    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]
    config_agents: list[QGetAgentsV4Item] | None
    config_models: list[QGetModelsV4Item] | None
    config_providers: list[QGetProvidersV4Item] | None
    config_tools: list[QGetToolsV4Item] | None

    draft_view: QGetFieldDraftsEntriesV4Item | None


# ========== List Endpoint Types ==========


class ListFieldApiField(BaseModel):
    field_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    conditional_parameter_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListFieldApiResponse(BaseModel):
    actor_name: str | None = None
    fields: list[ListFieldApiField] | None = None
    parameter_filter: ListFilterSection | None = None
    persona_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None


# ========== Save/Draft Resource Action Types ==========


class FieldResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class FieldMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveFieldApiRequest(BaseModel):
    """Request model for save field endpoint - flat resource IDs."""

    input_field_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    conditional_parameter_ids: list[UUID] | None = None


class SaveFieldApiResponse(BaseModel):
    success: bool
    field_id: UUID
    message: str


class SaveFieldSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_field_id: UUID | None = None
    names: FieldResourceAction
    descriptions: FieldResourceAction
    flags: FieldResourceAction
    departments: FieldMultiResourceAction
    conditional_parameters: FieldMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveFieldApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveFieldSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_field_id=request.input_field_id,
            names=FieldResourceAction(resource_id=request.name_id),
            descriptions=FieldResourceAction(resource_id=request.description_id),
            flags=FieldResourceAction(resource_id=request.flag_id),
            departments=FieldMultiResourceAction(resource_ids=request.department_ids),
            conditional_parameters=FieldMultiResourceAction(
                resource_ids=request.conditional_parameter_ids
            ),
        )

    def to_tuple(self) -> tuple:
        def single(a: FieldResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: FieldMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_field_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            multi(self.conditional_parameters),
        )


class SaveFieldSqlRow(BaseModel):
    field_id: UUID | None = None
    actor_name: str | None = None


class PatchFieldDraftApiRequest(BaseModel):
    """Request model for patch field draft endpoint - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    conditional_parameter_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchFieldDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchFieldDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: FieldResourceAction
    descriptions: FieldResourceAction
    flags: FieldResourceAction
    departments: FieldMultiResourceAction
    conditional_parameters: FieldMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchFieldDraftApiRequest, profile_id: UUID
    ) -> PatchFieldDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=FieldResourceAction(resource_id=request.name_id),
            descriptions=FieldResourceAction(resource_id=request.description_id),
            flags=FieldResourceAction(resource_id=request.flag_id),
            departments=FieldMultiResourceAction(resource_ids=request.department_ids),
            conditional_parameters=FieldMultiResourceAction(
                resource_ids=request.conditional_parameter_ids
            ),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: FieldResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: FieldMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            multi(self.conditional_parameters),
            self.expected_version,
        )


class PatchFieldDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# ========== Delete Endpoint Types ==========


class DeleteFieldApiRequest(BaseModel):
    field_id: UUID


class DeleteFieldApiResponse(BaseModel):
    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateFieldApiRequest(BaseModel):
    field_id: UUID


class DuplicateFieldApiResponse(BaseModel):
    success: bool
    field_id: UUID
    message: str

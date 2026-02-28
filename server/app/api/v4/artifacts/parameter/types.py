"""Handcrafted types for parameter artifact endpoints (section-first parity)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.types import InternalResponseBase
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetParameterDraftsEntriesV4Item,
    QGetParameterFieldsV4Item,
    QGetProvidersV4Item,
)


class ParameterFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class ParameterNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class ParameterDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class ParameterFlagSection(BaseResourceSection):
    current: list[ParameterFlagConfig] | None = None
    resources: list[ParameterFlagConfig] | None = None


class ParameterDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class ParameterFieldSection(BaseResourceSection):
    current: list[QGetParameterFieldsV4Item] | None = None
    resources: list[QGetParameterFieldsV4Item] | None = None


class GetParameterApiRequest(BaseModel):
    """Request model for get parameter endpoint."""

    parameter_id: UUID | None = None
    draft_id: UUID | None = None
    field_search: str | None = None
    field_show_selected: bool | None = None
    group_id: UUID | None = None


class GetParameterApiResponse(BaseModel):
    """Section-first client response for get parameter endpoint."""

    actor_name: str | None = None
    parameter_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    fields_step_show_ai_generate: bool | None = None

    names: ParameterNameSection | None = None
    descriptions: ParameterDescriptionSection | None = None
    flags: ParameterFlagSection | None = None
    departments: ParameterDepartmentSection | None = None
    fields: ParameterFieldSection | None = None


class ParameterWebsocketEntries(BaseModel):
    draft_parameter: QGetParameterDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class ParameterWebsocketResources(BaseModel):
    """Hydrated selected resources for websocket generation context."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[ParameterFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    fields: list[QGetParameterFieldsV4Item] | None = None


class GetParameterWebsocketResponse(InternalResponseBase):
    entries: ParameterWebsocketEntries | None = None
    resources: ParameterWebsocketResources


class ParameterResourceBucket(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[ParameterFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    fields: list[QGetParameterFieldsV4Item] | None = None


class ParameterResources(BaseModel):
    resources: ParameterResourceBucket | None = None
    current: ParameterResourceBucket | None = None


@dataclass
class ParameterInternalData:
    actor_name: str | None
    parameter_exists: bool | None
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
    fields_step_show_ai_generate: bool

    resources_payload: ParameterResources
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    config_agent_resources: list[QGetAgentsV4Item] | None
    config_model_resources: list[QGetModelsV4Item] | None
    config_provider_resources: list[QGetProvidersV4Item] | None


# ========== List Endpoint Types ==========


class ListParameterApiParameter(BaseModel):
    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    num_items: int | None = None
    sample_items: list[str] | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListParameterApiResponse(BaseModel):
    actor_name: str | None = None
    parameters: list[ListParameterApiParameter] | None = None
    scenario_filter: ListFilterSection | None = None
    field_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None


# ========== Save/Draft Resource Action Types ==========


class ParameterResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ParameterMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveParameterApiRequest(BaseModel):
    """Request model for save parameter endpoint - flat resource IDs."""

    input_parameter_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None


class SaveParameterApiResponse(BaseModel):
    success: bool
    parameter_id: UUID
    message: str


class SaveParameterSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_parameter_id: UUID | None = None
    names: ParameterResourceAction
    descriptions: ParameterResourceAction
    flags: ParameterMultiResourceAction
    departments: ParameterMultiResourceAction
    fields: ParameterMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveParameterApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveParameterSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_parameter_id=request.input_parameter_id,
            names=ParameterResourceAction(resource_id=request.name_id),
            descriptions=ParameterResourceAction(resource_id=request.description_id),
            flags=ParameterMultiResourceAction(resource_ids=request.flag_ids),
            departments=ParameterMultiResourceAction(
                resource_ids=request.department_ids
            ),
            fields=ParameterMultiResourceAction(resource_ids=request.field_ids),
        )

    def to_tuple(self) -> tuple:
        def single(a: ParameterResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ParameterMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_parameter_id,
            single(self.names),
            single(self.descriptions),
            multi(self.flags),
            multi(self.departments),
            multi(self.fields),
        )


class SaveParameterSqlRow(BaseModel):
    parameter_id: UUID | None = None
    actor_name: str | None = None


class PatchParameterDraftApiRequest(BaseModel):
    """Request model for patch parameter draft endpoint - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchParameterDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchParameterDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ParameterResourceAction
    descriptions: ParameterResourceAction
    flags: ParameterMultiResourceAction
    departments: ParameterMultiResourceAction
    fields: ParameterMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchParameterDraftApiRequest, profile_id: UUID
    ) -> PatchParameterDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=ParameterResourceAction(resource_id=request.name_id),
            descriptions=ParameterResourceAction(resource_id=request.description_id),
            flags=ParameterMultiResourceAction(resource_ids=request.flag_ids),
            departments=ParameterMultiResourceAction(
                resource_ids=request.department_ids
            ),
            fields=ParameterMultiResourceAction(resource_ids=request.field_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: ParameterResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ParameterMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            multi(self.flags),
            multi(self.departments),
            multi(self.fields),
            self.expected_version,
        )


class PatchParameterDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# ========== Delete Endpoint Types ==========


class DeleteParameterApiRequest(BaseModel):
    parameter_id: UUID


class DeleteParameterApiResponse(BaseModel):
    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateParameterApiRequest(BaseModel):
    parameter_id: UUID


class DuplicateParameterApiResponse(BaseModel):
    success: bool
    parameter_id: UUID
    message: str

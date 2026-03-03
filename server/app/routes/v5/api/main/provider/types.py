"""Handcrafted types for provider artifact endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.entries.runs.search import GetRunListViewResponse
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetEndpointsV4Item,
    QGetKeysV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProviderDraftsEntriesV4Item,
    QGetProvidersV4Item,
    QGetValuesV4Item,
)


class ProviderFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class ProviderNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class ProviderDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class ProviderFlagSection(BaseResourceSection):
    current: list[ProviderFlagConfig] | None = None
    resources: list[ProviderFlagConfig] | None = None


class ProviderDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class ProviderValueSection(BaseResourceSection):
    resource: QGetValuesV4Item | None = None
    resources: list[QGetValuesV4Item] | None = None


class ProviderEndpointSection(BaseResourceSection):
    resource: QGetEndpointsV4Item | None = None
    resources: list[QGetEndpointsV4Item] | None = None


class ProviderKeySection(BaseResourceSection):
    resource: QGetKeysV4Item | None = None
    resources: list[QGetKeysV4Item] | None = None


class GetProviderApiRequest(BaseModel):
    """Request model for get provider endpoint."""

    provider_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None


class GetProviderApiResponse(BaseModel):
    """Section-first response for provider editor."""

    actor_name: str | None = None
    provider_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    integrations_show_ai_generate: bool | None = None

    names: ProviderNameSection | None = None
    descriptions: ProviderDescriptionSection | None = None
    flags: ProviderFlagSection | None = None
    departments: ProviderDepartmentSection | None = None
    values: ProviderValueSection | None = None
    endpoints: ProviderEndpointSection | None = None
    keys: ProviderKeySection | None = None


class ProviderWebsocketEntries(BaseModel):
    """Entries data for websocket response."""

    draft_provider: QGetProviderDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class ProviderWebsocketResources(BaseModel):
    """Hydrated resources for websocket — selected only."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[ProviderFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    values: list[QGetValuesV4Item] | None = None
    endpoints: list[QGetEndpointsV4Item] | None = None
    keys: list[QGetKeysV4Item] | None = None


class GetProviderWebsocketResponse(InternalResponseBase):
    """Minimal response for WebSocket handlers."""

    entries: ProviderWebsocketEntries | None = None
    resources: ProviderWebsocketResources


@dataclass
class ProviderInternalData:
    """Internal data from core provider fetching (cacheable layer)."""

    actor_name: str | None
    provider_exists: bool | None
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
    integrations_show_ai_generate: bool
    name_resource: QGetNamesV4Item | None
    description_resource: QGetDescriptionsV4Item | None
    value_resource: QGetValuesV4Item | None
    endpoint_resource: QGetEndpointsV4Item | None
    key_resource: QGetKeysV4Item | None
    provider_flags: list[ProviderFlagConfig]
    department_resources: list[QGetDepartmentsV4Item]
    names: list[QGetNamesV4Item]
    descriptions: list[QGetDescriptionsV4Item]
    flags: list[ProviderFlagConfig]
    departments: list[QGetDepartmentsV4Item]
    values: list[QGetValuesV4Item]
    endpoints: list[QGetEndpointsV4Item]
    keys: list[QGetKeysV4Item]
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]
    config_agent_resources: list[QGetAgentsV4Item] | None
    config_model_resources: list[QGetModelsV4Item] | None
    config_provider_resources: list[QGetProvidersV4Item] | None


class ListProviderApiProvider(BaseModel):
    """Provider type for list endpoint with computed permissions."""

    provider_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    active: bool | None = None
    updated_at: datetime | None = None
    department_ids: list[UUID] | None = None
    model_usage_count: int | None = None
    model_ids: list[UUID] | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


class ListProviderApiResponse(BaseModel):
    actor_name: str | None = None
    providers: list[ListProviderApiProvider] | None = None
    department_filter: ListFilterSection | None = None
    model_filter: ListFilterSection | None = None
    status_filter: ListFilterSection | None = None
    total_count: int | None = None


class SaveProviderApiRequest(BaseModel):
    """Flat-ID save request for provider endpoint."""

    input_provider_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    value_id: UUID | None = None
    endpoint_id: UUID | None = None
    key_id: UUID | None = None


class SaveProviderApiResponse(BaseModel):
    success: bool
    provider_id: UUID
    message: str


class SaveProviderSqlParams(BaseModel):
    """SQL parameters for save provider."""

    profile_id: UUID
    group_id: UUID | None = None
    input_provider_id: UUID | None = None
    names: ProviderResourceAction
    descriptions: ProviderResourceAction
    flags: ProviderResourceAction
    departments: ProviderMultiResourceAction
    values: ProviderResourceAction
    endpoints: ProviderResourceAction
    keys: ProviderResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveProviderApiRequest,
        profile_id: UUID,
        group_id: UUID | None = None,
    ) -> SaveProviderSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_provider_id=request.input_provider_id,
            names=ProviderResourceAction(resource_id=request.name_id),
            descriptions=ProviderResourceAction(resource_id=request.description_id),
            flags=ProviderResourceAction(resource_id=request.flag_id),
            departments=ProviderMultiResourceAction(
                resource_ids=request.department_ids
            ),
            values=ProviderResourceAction(resource_id=request.value_id),
            endpoints=ProviderResourceAction(resource_id=request.endpoint_id),
            keys=ProviderResourceAction(resource_id=request.key_id),
        )

    def to_tuple(self) -> tuple:
        def single(a: ProviderResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ProviderMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_provider_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            single(self.values),
            single(self.endpoints),
            single(self.keys),
        )


class SaveProviderSqlRow(BaseModel):
    provider_id: UUID | None = None
    actor_name: str | None = None


class DeleteProviderApiRequest(BaseModel):
    provider_id: UUID


class DeleteProviderApiResponse(BaseModel):
    success: bool
    message: str


class DuplicateProviderApiRequest(BaseModel):
    provider_id: UUID


class DuplicateProviderApiResponse(BaseModel):
    success: bool
    provider_id: UUID
    message: str


class PatchProviderDraftApiRequest(BaseModel):
    """Flat-ID patch draft request for provider endpoint."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    value_id: UUID | None = None
    endpoint_id: UUID | None = None
    key_id: UUID | None = None
    expected_version: int = 0


class PatchProviderDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class ProviderResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ProviderMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class PatchProviderDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ProviderResourceAction
    descriptions: ProviderResourceAction
    flags: ProviderResourceAction
    departments: ProviderMultiResourceAction
    values: ProviderResourceAction
    endpoints: ProviderResourceAction
    keys: ProviderResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchProviderDraftApiRequest, profile_id: UUID
    ) -> PatchProviderDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=ProviderResourceAction(resource_id=request.name_id),
            descriptions=ProviderResourceAction(resource_id=request.description_id),
            flags=ProviderResourceAction(resource_id=request.flag_id),
            departments=ProviderMultiResourceAction(
                resource_ids=request.department_ids
            ),
            values=ProviderResourceAction(resource_id=request.value_id),
            endpoints=ProviderResourceAction(resource_id=request.endpoint_id),
            keys=ProviderResourceAction(resource_id=request.key_id),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: ProviderResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ProviderMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            single(self.values),
            single(self.endpoints),
            single(self.keys),
            self.expected_version,
        )


class PatchProviderDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None

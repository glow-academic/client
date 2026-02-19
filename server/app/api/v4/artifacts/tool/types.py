"""Handcrafted types for tool artifact endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.api.v4.views.run.list.types import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgPositionsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetDescriptionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolDraftsEntriesV4Item,
    QGetToolsV4Item,
)


class ToolFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class ToolNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class ToolDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class ToolFlagSection(BaseResourceSection):
    current: ToolFlagConfig | None = None
    resources: list[ToolFlagConfig] | None = None


class ToolArgSection(BaseResourceSection):
    current: list[QGetArgsV4Item] | None = None
    resources: list[QGetArgsV4Item] | None = None


class ToolArgOutputSection(BaseResourceSection):
    current: list[QGetArgsOutputsV4Item] | None = None
    resources: list[QGetArgsOutputsV4Item] | None = None


class ToolArgPositionSection(BaseResourceSection):
    current: list[QGetArgPositionsV4Item] | None = None
    resources: list[QGetArgPositionsV4Item] | None = None


class GetToolApiRequest(BaseModel):
    tool_id: UUID | None = None
    draft_id: UUID | None = None


class GetToolApiResponse(BaseModel):
    actor_name: str | None = None
    tool_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    args_show_ai_generate: bool | None = None
    arg_positions_show_ai_generate: bool | None = None
    args_outputs_show_ai_generate: bool | None = None

    names: ToolNameSection | None = None
    descriptions: ToolDescriptionSection | None = None
    flags: ToolFlagSection | None = None
    args: ToolArgSection | None = None
    arg_positions: ToolArgPositionSection | None = None
    args_outputs: ToolArgOutputSection | None = None


class ToolWebsocketViews(BaseModel):
    draft_tool: QGetToolDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class ToolWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[ToolFlagConfig] | None = None
    args: list[QGetArgsV4Item] | None = None
    arg_positions: list[QGetArgPositionsV4Item] | None = None
    args_outputs: list[QGetArgsOutputsV4Item] | None = None

    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    # Profile config (for rate limiting)
    config_profile: list[QGetProfilesV4Item] | None = None


class GetToolWebsocketResponse(BaseModel):
    views: ToolWebsocketViews | None = None
    resources: ToolWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class ToolResourceBucket(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    args: list[QGetArgsV4Item] | None = None
    arg_positions: list[QGetArgPositionsV4Item] | None = None
    args_outputs: list[QGetArgsOutputsV4Item] | None = None
    flags: list[ToolFlagConfig] | None = None


class ToolResources(BaseModel):
    resources: ToolResourceBucket | None = None
    current: ToolResourceBucket | None = None


@dataclass
class ToolInternalData:
    actor_name: str | None
    tool_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    agent_ids: dict[str, UUID | None]
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]
    suggestions_map: dict[str, list[UUID]]
    show_ai_generate_map: dict[str, bool]

    resources_payload: ToolResources
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    config_agent_resources: list[QGetAgentsV4Item] | None
    config_model_resources: list[QGetModelsV4Item] | None
    config_provider_resources: list[QGetProvidersV4Item] | None


class ListToolApiTool(BaseModel):
    tool_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    updated_at: datetime | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListToolApiResponse(BaseModel):
    actor_name: str | None = None
    tools: list[ListToolApiTool] | None = None
    department_filter: ListFilterSection | None = None
    agent_filter: ListFilterSection | None = None
    creatable_filter: ListFilterSection | None = None
    total_count: int | None = None


class ToolResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ToolMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveToolApiRequest(BaseModel):
    """Flat-ID save request for tool endpoint."""

    input_tool_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_id: UUID | None = None
    arg_ids: list[UUID] | None = None
    arg_position_ids: list[UUID] | None = None
    args_output_ids: list[UUID] | None = None


class SaveToolApiResponse(BaseModel):
    success: bool
    tool_id: UUID
    message: str


class SaveToolSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_tool_id: UUID | None = None

    names: ToolResourceAction
    descriptions: ToolResourceAction
    flags: ToolResourceAction
    args: ToolMultiResourceAction
    arg_positions: ToolMultiResourceAction
    args_outputs: ToolMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveToolApiRequest,
        profile_id: UUID,
        group_id: UUID | None = None,
    ) -> SaveToolSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_tool_id=request.input_tool_id,
            names=ToolResourceAction(resource_id=request.name_id),
            descriptions=ToolResourceAction(resource_id=request.description_id),
            flags=ToolResourceAction(resource_id=request.flag_id),
            args=ToolMultiResourceAction(resource_ids=request.arg_ids),
            arg_positions=ToolMultiResourceAction(
                resource_ids=request.arg_position_ids
            ),
            args_outputs=ToolMultiResourceAction(resource_ids=request.args_output_ids),
        )

    def to_tuple(self) -> tuple:
        def single(a: ToolResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ToolMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_tool_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.args),
            multi(self.arg_positions),
            multi(self.args_outputs),
        )


class SaveToolSqlRow(BaseModel):
    tool_id: UUID | None = None
    actor_name: str | None = None


class DeleteToolApiRequest(BaseModel):
    tool_id: UUID


class DeleteToolApiResponse(BaseModel):
    success: bool
    message: str


class DuplicateToolApiRequest(BaseModel):
    tool_id: UUID


class DuplicateToolApiResponse(BaseModel):
    success: bool
    tool_id: UUID
    message: str


class PatchToolDraftApiRequest(BaseModel):
    """Flat-ID patch draft request for tool endpoint."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    expected_version: int = 0
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    arg_ids: list[UUID] | None = None
    arg_position_ids: list[UUID] | None = None
    args_output_ids: list[UUID] | None = None


class PatchToolDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchToolDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ToolResourceAction
    descriptions: ToolResourceAction
    flags: ToolResourceAction
    args: ToolMultiResourceAction
    arg_positions: ToolMultiResourceAction
    args_outputs: ToolMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchToolDraftApiRequest, profile_id: UUID
    ) -> PatchToolDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=ToolResourceAction(resource_id=request.name_id),
            descriptions=ToolResourceAction(resource_id=request.description_id),
            flags=ToolResourceAction(resource_id=request.flag_id),
            args=ToolMultiResourceAction(resource_ids=request.arg_ids),
            arg_positions=ToolMultiResourceAction(
                resource_ids=request.arg_position_ids
            ),
            args_outputs=ToolMultiResourceAction(resource_ids=request.args_output_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: ToolResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ToolMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.args),
            multi(self.arg_positions),
            multi(self.args_outputs),
            self.expected_version,
        )

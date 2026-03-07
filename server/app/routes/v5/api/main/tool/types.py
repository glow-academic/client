"""Handcrafted types for tool artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.types import BaseResourceSection, ListFilterSection


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
    resource: object | None = None
    resources: list | None = None


class ToolDescriptionSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class ToolFlagSection(BaseResourceSection):
    current: ToolFlagConfig | None = None
    resources: list[ToolFlagConfig] | None = None


class ToolArgSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class ToolArgOutputSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class ToolArgPositionSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class GetToolApiRequest(BaseModel):
    tool_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


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


class SaveToolFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveToolItem(BaseModel):
    """Single tool item for save — provide ID or value per field (not both).

    Junctions from get.py: names, descriptions, departments, flags, args,
    args_outputs, arg_positions, artifacts, entries, operations, resources, tools.
    Dual-mode: name (create), description (create).
    All others: IDs only.
    """

    input_tool_id: UUID | None = None
    # Dual-mode: name
    name_id: UUID | None = None
    name: str | None = None
    # Dual-mode: description
    description_id: UUID | None = None
    description: str | None = None
    # ID-only fields
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    arg_positions_ids: list[UUID] | None = None
    args_ids: list[UUID] | None = None
    args_outputs_ids: list[UUID] | None = None
    artifact_ids: list[UUID] | None = None
    entry_ids: list[UUID] | None = None
    operation_ids: list[UUID] | None = None
    resource_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None


class SaveToolApiRequest(BaseModel):
    """Request model for bulk save tool endpoint."""

    tools: list[SaveToolItem]
    group_id: UUID | None = None


class SaveToolResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    tool_id: UUID | None = None
    message: str
    errors: list[SaveToolFieldError] | None = None


class SaveToolApiResponse(BaseModel):
    """Response model for bulk save tool endpoint."""

    results: list[SaveToolResult]


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
    """Request model for new-style tool draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, arg_ids, arg_position_ids, args_output_ids,
        entry_ids, resource_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    arg_ids: list[UUID] | None = None
    arg_position_ids: list[UUID] | None = None
    args_output_ids: list[UUID] | None = None
    entry_ids: list[UUID] | None = None
    resource_ids: list[UUID] | None = None


class PatchToolDraftApiResponse(BaseModel):
    """Response model for new-style tool draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str

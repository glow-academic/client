"""Handcrafted types for tool artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.infra.tool_create import CreateToolItem
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
    group_id: UUID | None = None


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


class ToolFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class ToolResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    tool_id: UUID | None = None
    message: str
    errors: list[ToolFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateToolApiRequest(BaseModel):
    """Request model for bulk create tool endpoint."""

    tools: list[CreateToolItem]
    group_id: UUID | None = None


class CreateToolApiResponse(BaseModel):
    """Response model for bulk create tool endpoint."""

    results: list[ToolResultItem]


# ========== Update Endpoint Types ==========


class UpdateToolItem(BaseModel):
    """Single tool item for update — tool_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    tool_id: UUID  # Required — which tool to update
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


class UpdateToolApiRequest(BaseModel):
    """Request model for bulk update tool endpoint."""

    tools: list[UpdateToolItem]
    group_id: UUID | None = None


class UpdateToolApiResponse(BaseModel):
    """Response model for bulk update tool endpoint."""

    results: list[ToolResultItem]


class SaveToolFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DeleteToolApiRequest(BaseModel):
    """Request model for bulk delete tool endpoint."""

    tool_ids: list[UUID]


class DeleteToolResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    tool_id: UUID
    message: str


class DeleteToolApiResponse(BaseModel):
    """Response model for bulk delete tool endpoint."""

    results: list[DeleteToolResult]


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

    group_id: UUID | None = None
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


class ToolDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID]
    department_ids: list[UUID]
    arg_ids: list[UUID]
    arg_position_ids: list[UUID]
    args_output_ids: list[UUID]
    entry_ids: list[UUID]
    resource_ids: list[UUID]


class PatchToolDraftApiResponse(BaseModel):
    """Response model for new-style tool draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: ToolDraftFormState | None = None


# ========== Export Endpoint Types ==========


class ExportToolApiResponse(BaseModel):
    """Response model for export tool endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int

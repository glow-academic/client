"""Handcrafted types for tool GET endpoint."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class ToolFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "tool_active"
    label: str  # e.g., "Active"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None  # Domain ID for generation
    generated: bool | None = None


class GetToolApiRequest(BaseModel):
    """Request model for get tool endpoint."""

    tool_id: UUID | None = None
    draft_id: UUID | None = None


class GetToolApiResponse(BaseModel):
    """Response model for get tool endpoint."""

    # Required fields
    actor_name: str | None = None
    tool_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    args_group_id: UUID | None = None
    args_outputs_group_id: UUID | None = None
    flags_group_id: UUID | None = None

    # Single-select resources: name
    show_name: bool | None = None
    name_domain_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    name_show_ai_generate: bool | None = None

    # Single-select resources: description
    show_description: bool | None = None
    description_domain_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    description_show_ai_generate: bool | None = None

    # Single-select resources: flag
    show_flag: bool | None = None
    flag_domain_id: UUID | None = None
    flag_required: bool | None = None
    flag_show_ai_generate: bool | None = None

    # Multi-select resources: args
    show_args: bool | None = None
    args_domain_id: UUID | None = None
    args_required: bool | None = None
    args_suggestions: list[UUID] | None = None
    args_show_ai_generate: bool | None = None

    # Multi-select resources: args_outputs
    show_args_outputs: bool | None = None
    args_outputs_domain_id: UUID | None = None
    args_outputs_required: bool | None = None
    args_outputs_suggestions: list[UUID] | None = None
    args_outputs_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    args_create_tool_id: UUID | None = None
    args_outputs_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    args_link_tool_id: UUID | None = None
    args_outputs_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: ToolResources | None = None


class GetToolWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_tool_websocket).

    Contains only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    args_domain_id: UUID | None = None
    args_outputs_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: ToolResources | None = None


class ToolResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    args: list[QGetArgsV4Item] | None = None
    args_outputs: list[QGetArgsOutputsV4Item] | None = None
    flags: list[ToolFlagConfig] | None = None


class ToolResources(BaseModel):
    """Full resources + current selections."""

    resources: ToolResourceBucket | None = None
    current: ToolResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListToolApiTool(BaseModel):
    """Tool type for list endpoint with computed permissions."""

    tool_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    updated_at: datetime | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListToolApiResponse(BaseModel):
    """Response model for list tool endpoint with computed permissions."""

    actor_name: str | None = None
    tools: list[ListToolApiTool] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SaveToolApiRequest(BaseModel):
    """Request model for save tool endpoint - accepts resource IDs directly."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_tool_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    args_ids: list[UUID] | None = None
    args_outputs_ids: list[UUID] | None = None


class SaveToolApiResponse(BaseModel):
    """Response model for save tool endpoint."""

    success: bool
    tool_id: UUID
    message: str


class SaveToolSqlParams(BaseModel):
    """SQL parameters for save tool."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED
    input_tool_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    args_ids: list[UUID] | None = None
    args_outputs_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_tool_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.args_ids,
            self.args_outputs_ids,
        )


class SaveToolSqlRow(BaseModel):
    """SQL row for save tool."""

    tool_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteToolApiRequest(BaseModel):
    """Request model for delete tool endpoint."""

    tool_id: UUID


class DeleteToolApiResponse(BaseModel):
    """Response model for delete tool endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateToolApiRequest(BaseModel):
    """Request model for duplicate tool endpoint."""

    tool_id: UUID


class DuplicateToolApiResponse(BaseModel):
    """Response model for duplicate tool endpoint."""

    success: bool
    tool_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchToolDraftApiRequest(BaseModel):
    """Request model for patch tool draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    args_ids: list[UUID] | None = None
    args_outputs_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchToolDraftApiResponse(BaseModel):
    """Response model for patch tool draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str

"""Handcrafted types for provider artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetRegeneratesV4Item,
    QGetValuesV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class ProviderFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active"
    label: str  # e.g., "Active"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None  # Domain ID for generation
    generated: bool | None = None


class GetProviderApiRequest(BaseModel):
    """Request model for get provider endpoint."""

    provider_id: UUID | None = None
    draft_id: UUID | None = None


class GetProviderApiResponse(BaseModel):
    """Response model for get provider endpoint."""

    # Required fields
    actor_name: str | None = None
    provider_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    values_group_id: UUID | None = None
    regenerates_group_id: UUID | None = None

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

    # Multi-select resources: departments
    show_departments: bool | None = None
    departments_domain_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments_show_ai_generate: bool | None = None

    # Single-select resources: value
    show_value: bool | None = None
    value_domain_id: UUID | None = None
    value_required: bool | None = None
    value_suggestions: list[UUID] | None = None
    value_show_ai_generate: bool | None = None

    # Single-select resources: regenerates
    show_regenerates: bool | None = None
    regenerates_domain_id: UUID | None = None
    regenerates_required: bool | None = None
    regenerates_suggestions: list[UUID] | None = None
    regenerates_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    value_create_tool_id: UUID | None = None
    regenerates_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    value_link_tool_id: UUID | None = None
    regenerates_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: ProviderResources | None = None


class GetProviderWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_provider_websocket).

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
    departments_domain_id: UUID | None = None
    value_domain_id: UUID | None = None
    regenerates_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: ProviderResources | None = None


class ProviderResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[ProviderFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    values: list[QGetValuesV4Item] | None = None
    regenerates: list[QGetRegeneratesV4Item] | None = None


class ProviderResources(BaseModel):
    """Full resources + current selections."""

    resources: ProviderResourceBucket | None = None
    current: ProviderResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListProviderApiProvider(BaseModel):
    """Provider type for list endpoint with computed permissions."""

    provider_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    active: bool | None = None
    updated_at: datetime | None = None
    model_usage_count: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


class ListProviderApiProviderOption(BaseModel):
    """Provider option type for list endpoint."""

    value: str | None = None
    label: str | None = None


class ListProviderApiStatusOption(BaseModel):
    """Status option type for list endpoint."""

    value: str | None = None
    label: str | None = None


class ListProviderApiResponse(BaseModel):
    """Response model for list provider endpoint with computed permissions."""

    actor_name: str | None = None
    providers: list[ListProviderApiProvider] | None = None
    provider_options: list[ListProviderApiProviderOption] | None = None
    status_options: list[ListProviderApiStatusOption] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SaveProviderApiRequest(BaseModel):
    """Request model for save provider endpoint - accepts form data directly (no draft_id)."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_provider_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    value_id: UUID | None = None
    regenerates_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None


class SaveProviderApiResponse(BaseModel):
    """Response model for save provider endpoint."""

    success: bool
    provider_id: UUID
    message: str


class SaveProviderSqlParams(BaseModel):
    """SQL parameters for save provider - accepts form data directly (no draft_id)."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_provider_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    value_id: UUID | None = None
    regenerates_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_provider_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.value_id,
            self.regenerates_id,
            self.department_ids,
        )


class SaveProviderSqlRow(BaseModel):
    """SQL row for save provider."""

    provider_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteProviderApiRequest(BaseModel):
    """Request model for delete provider endpoint."""

    provider_id: UUID


class DeleteProviderApiResponse(BaseModel):
    """Response model for delete provider endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateProviderApiRequest(BaseModel):
    """Request model for duplicate provider endpoint."""

    provider_id: UUID


class DuplicateProviderApiResponse(BaseModel):
    """Response model for duplicate provider endpoint."""

    success: bool
    provider_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchProviderDraftApiRequest(BaseModel):
    """Request model for patch provider draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    value_id: UUID | None = None
    regenerates_id: UUID | None = None
    department_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchProviderDraftApiResponse(BaseModel):
    """Response model for patch provider draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str

"""Handcrafted types for auth artifact endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetProtocolsV4Item,
    QGetSlugsV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class AuthFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None
    generated: bool | None = None


class AuthItemData(BaseModel):
    """Auth item data for display."""

    auth_item_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    position: int | None = None
    active: bool | None = None
    value_masked: str | None = None
    key_id: str | None = None
    encrypted: bool | None = None


class GetAuthApiRequest(BaseModel):
    """Request model for get auth endpoint."""

    auth_id: UUID | None = None
    draft_id: UUID | None = None


class GetAuthApiResponse(BaseModel):
    """Response model for get auth endpoint."""

    # Required fields
    actor_name: str | None = None
    auth_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    protocols_group_id: UUID | None = None
    slugs_group_id: UUID | None = None

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

    # Multi-select resources: protocols
    show_protocols: bool | None = None
    protocols_domain_id: UUID | None = None
    protocols_required: bool | None = None
    protocol_suggestions: list[UUID] | None = None
    protocols_show_ai_generate: bool | None = None

    # Multi-select resources: slugs
    show_slugs: bool | None = None
    slugs_domain_id: UUID | None = None
    slugs_required: bool | None = None
    slug_suggestions: list[UUID] | None = None
    slugs_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    protocols_create_tool_id: UUID | None = None
    slugs_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    protocols_link_tool_id: UUID | None = None
    slugs_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload
    resources: AuthResources | None = None

    # Auth items (special junction)
    auth_items: list[AuthItemData] | None = None


class GetAuthWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers."""

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    protocols_domain_id: UUID | None = None
    slugs_domain_id: UUID | None = None

    # Domains mapping for agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: AuthResources | None = None


class AuthResourceBucket(BaseModel):
    """Generic resources bucket with full objects."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[AuthFlagConfig] | None = None
    protocols: list[QGetProtocolsV4Item] | None = None
    slugs: list[QGetSlugsV4Item] | None = None


class AuthResources(BaseModel):
    """Full resources + current selections."""

    resources: AuthResourceBucket | None = None
    current: AuthResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListAuthApiAuth(BaseModel):
    """Auth type for list endpoint with computed permissions."""

    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    protocol_count: int | None = None
    slug_count: int | None = None
    item_count: int | None = None
    is_inactive: bool | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListAuthApiResponse(BaseModel):
    """Response model for list auth endpoint with computed permissions."""

    actor_name: str | None = None
    auths: list[ListAuthApiAuth] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SaveAuthApiRequest(BaseModel):
    """Request model for save auth endpoint - accepts form data directly."""

    # Context
    group_id: UUID
    input_auth_id: UUID | None = None

    # Required single-select resources
    name_id: UUID

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    protocol_ids: list[UUID] | None = None
    slug_ids: list[UUID] | None = None

    # Auth items inline
    auth_items: list[SaveAuthItemInput] | None = None


class SaveAuthItemInput(BaseModel):
    """Auth item input for save endpoint."""

    name: str
    description: str | None = None
    encrypted: bool = True
    position: int | None = None
    active: bool = True
    key_id: UUID | None = None


class SaveAuthApiResponse(BaseModel):
    """Response model for save auth endpoint."""

    success: bool
    auth_id: UUID
    message: str


class SaveAuthSqlParams(BaseModel):
    """SQL parameters for save auth."""

    profile_id: UUID
    group_id: UUID
    input_auth_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    protocol_ids: list[UUID] | None = None
    slug_ids: list[UUID] | None = None
    auth_items_junction: list[tuple] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_auth_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.protocol_ids or [],
            self.slug_ids or [],
            self.auth_items_junction or [],
        )


class SaveAuthSqlRow(BaseModel):
    """SQL row for save auth."""

    auth_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteAuthApiRequest(BaseModel):
    """Request model for delete auth endpoint."""

    auth_id: UUID


class DeleteAuthApiResponse(BaseModel):
    """Response model for delete auth endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateAuthApiRequest(BaseModel):
    """Request model for duplicate auth endpoint."""

    auth_id: UUID


class DuplicateAuthApiResponse(BaseModel):
    """Response model for duplicate auth endpoint."""

    success: bool
    auth_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchAuthDraftApiRequest(BaseModel):
    """Request model for patch auth draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    protocol_ids: list[UUID] | None = None
    slug_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchAuthDraftApiResponse(BaseModel):
    """Response model for patch auth draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str

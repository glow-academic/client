"""Handcrafted types for model artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetEndpointsV4Item,
    QGetKeysV4Item,
    QGetModalitiesV4Item,
    QGetNamesV4Item,
    QGetPricingV4Item,
    QGetQualitiesV4Item,
    QGetReasoningLevelsV4Item,
    QGetTemperatureLevelsV4Item,
    QGetValuesV4Item,
    QGetVoicesV4Item,
)


class QGetProvidersV4Item(BaseModel):
    """Provider resource item (placeholder until endpoint exists)."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class ModelFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active", "modalities_enabled"
    label: str  # e.g., "Active", "Modalities Enabled"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None  # Domain ID for generation
    generated: bool | None = None


class GetModelApiRequest(BaseModel):
    """Request model for get model endpoint."""

    model_id: UUID | None = None
    draft_id: UUID | None = None
    # Search filters for resources
    value_search: str | None = None
    endpoint_search: str | None = None
    key_search: str | None = None
    # Show selected filters
    value_show_selected: bool | None = None
    endpoint_show_selected: bool | None = None
    key_show_selected: bool | None = None


class GetModelApiResponse(BaseModel):
    """Response model for get model endpoint."""

    # Required fields
    actor_name: str | None = None
    model_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    values_group_id: UUID | None = None
    endpoints_group_id: UUID | None = None
    providers_group_id: UUID | None = None
    keys_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    modalities_group_id: UUID | None = None
    temperature_levels_group_id: UUID | None = None
    pricing_group_id: UUID | None = None
    reasoning_levels_group_id: UUID | None = None
    qualities_group_id: UUID | None = None
    voices_group_id: UUID | None = None

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

    # Single-select resources: value
    show_value: bool | None = None
    value_domain_id: UUID | None = None
    value_required: bool | None = None
    value_suggestions: list[UUID] | None = None
    value_show_ai_generate: bool | None = None

    # Single-select resources: endpoint
    show_endpoint: bool | None = None
    endpoint_domain_id: UUID | None = None
    endpoint_required: bool | None = None
    endpoint_suggestions: list[UUID] | None = None
    endpoint_show_ai_generate: bool | None = None

    # Single-select resources: provider
    show_provider: bool | None = None
    provider_domain_id: UUID | None = None
    provider_required: bool | None = None
    provider_suggestions: list[UUID] | None = None
    provider_show_ai_generate: bool | None = None

    # Single-select resources: key
    show_key: bool | None = None
    key_domain_id: UUID | None = None
    key_required: bool | None = None
    key_suggestions: list[UUID] | None = None
    key_show_ai_generate: bool | None = None

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

    # Multi-select resources: modalities (input + output)
    show_modalities: bool | None = None
    modalities_domain_id: UUID | None = None
    modalities_required: bool | None = None
    input_modality_suggestions: list[UUID] | None = None
    output_modality_suggestions: list[UUID] | None = None
    modalities_show_ai_generate: bool | None = None

    # Multi-select resources: temperature_levels
    show_temperature_levels: bool | None = None
    temperature_levels_domain_id: UUID | None = None
    temperature_levels_required: bool | None = None
    temperature_level_suggestions: list[UUID] | None = None
    temperature_levels_show_ai_generate: bool | None = None

    # Multi-select resources: pricing
    show_pricing: bool | None = None
    pricing_domain_id: UUID | None = None
    pricing_required: bool | None = None
    pricing_suggestions: list[UUID] | None = None
    pricing_show_ai_generate: bool | None = None

    # Multi-select resources: reasoning_levels
    show_reasoning_levels: bool | None = None
    reasoning_levels_domain_id: UUID | None = None
    reasoning_levels_required: bool | None = None
    reasoning_level_suggestions: list[UUID] | None = None
    reasoning_levels_show_ai_generate: bool | None = None

    # Multi-select resources: qualities
    show_qualities: bool | None = None
    qualities_domain_id: UUID | None = None
    qualities_required: bool | None = None
    quality_suggestions: list[UUID] | None = None
    qualities_show_ai_generate: bool | None = None

    # Multi-select resources: voices
    show_voices: bool | None = None
    voices_domain_id: UUID | None = None
    voices_required: bool | None = None
    voice_suggestions: list[UUID] | None = None
    voices_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    provider_show_ai_generate: bool | None = None
    features_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    value_create_tool_id: UUID | None = None
    endpoint_create_tool_id: UUID | None = None
    key_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    value_link_tool_id: UUID | None = None
    endpoint_link_tool_id: UUID | None = None
    provider_link_tool_id: UUID | None = None
    key_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    modalities_link_tool_id: UUID | None = None
    temperature_levels_link_tool_id: UUID | None = None
    pricing_link_tool_id: UUID | None = None
    reasoning_levels_link_tool_id: UUID | None = None
    qualities_link_tool_id: UUID | None = None
    voices_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: ModelResources | None = None


class GetModelWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_model_websocket).

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
    value_domain_id: UUID | None = None
    endpoint_domain_id: UUID | None = None
    provider_domain_id: UUID | None = None
    key_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    modalities_domain_id: UUID | None = None
    temperature_levels_domain_id: UUID | None = None
    pricing_domain_id: UUID | None = None
    reasoning_levels_domain_id: UUID | None = None
    qualities_domain_id: UUID | None = None
    voices_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: ModelResources | None = None


class ModelResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    values: list[QGetValuesV4Item] | None = None
    endpoints: list[QGetEndpointsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    keys: list[QGetKeysV4Item] | None = None
    flags: list[ModelFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    input_modalities: list[QGetModalitiesV4Item] | None = None
    output_modalities: list[QGetModalitiesV4Item] | None = None
    temperature_levels: list[QGetTemperatureLevelsV4Item] | None = None
    pricing: list[QGetPricingV4Item] | None = None
    reasoning_levels: list[QGetReasoningLevelsV4Item] | None = None
    qualities: list[QGetQualitiesV4Item] | None = None
    voices: list[QGetVoicesV4Item] | None = None


class ModelResources(BaseModel):
    """Full resources + current selections."""

    resources: ModelResourceBucket | None = None
    current: ModelResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListModelApiModel(BaseModel):
    """Model type for list endpoint with computed permissions."""

    model_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    provider_name: str | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListModelApiResponse(BaseModel):
    """Response model for list model endpoint with computed permissions."""

    actor_name: str | None = None
    models: list[ListModelApiModel] | None = None
    departments: list[dict] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SaveModelApiRequest(BaseModel):
    """Request model for save model endpoint - accepts form data directly."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_model_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED
    value_id: UUID  # REQUIRED
    endpoint_id: UUID  # REQUIRED
    provider_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    key_id: UUID | None = None
    active_flag_id: UUID | None = None
    modalities_enabled_flag_id: UUID | None = None
    temperature_enabled_flag_id: UUID | None = None
    pricing_enabled_flag_id: UUID | None = None
    voices_enabled_flag_id: UUID | None = None
    reasoning_levels_enabled_flag_id: UUID | None = None
    qualities_enabled_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    input_modality_ids: list[UUID] | None = None
    output_modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class SaveModelApiResponse(BaseModel):
    """Response model for save model endpoint."""

    success: bool
    model_id: UUID
    message: str


class SaveModelSqlParams(BaseModel):
    """SQL parameters for save model."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_model_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED
    value_id: UUID  # REQUIRED
    endpoint_id: UUID  # REQUIRED
    provider_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    key_id: UUID | None = None
    active_flag_id: UUID | None = None
    modalities_enabled_flag_id: UUID | None = None
    temperature_enabled_flag_id: UUID | None = None
    pricing_enabled_flag_id: UUID | None = None
    voices_enabled_flag_id: UUID | None = None
    reasoning_levels_enabled_flag_id: UUID | None = None
    qualities_enabled_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    input_modality_ids: list[UUID] | None = None
    output_modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_model_id,
            self.name_id,
            self.value_id,
            self.endpoint_id,
            self.provider_id,
            self.description_id,
            self.key_id,
            self.active_flag_id,
            self.modalities_enabled_flag_id,
            self.temperature_enabled_flag_id,
            self.pricing_enabled_flag_id,
            self.voices_enabled_flag_id,
            self.reasoning_levels_enabled_flag_id,
            self.qualities_enabled_flag_id,
            self.department_ids,
            self.input_modality_ids,
            self.output_modality_ids,
            self.temperature_level_ids,
            self.pricing_ids,
            self.reasoning_level_ids,
            self.quality_ids,
            self.voice_ids,
        )


class SaveModelSqlRow(BaseModel):
    """SQL row for save model."""

    model_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteModelApiRequest(BaseModel):
    """Request model for delete model endpoint."""

    model_id: UUID


class DeleteModelApiResponse(BaseModel):
    """Response model for delete model endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateModelApiRequest(BaseModel):
    """Request model for duplicate model endpoint."""

    model_id: UUID


class DuplicateModelApiResponse(BaseModel):
    """Response model for duplicate model endpoint."""

    success: bool
    model_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchModelDraftApiRequest(BaseModel):
    """Request model for patch model draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    value_id: UUID | None = None
    endpoint_id: UUID | None = None
    provider_id: UUID | None = None
    key_id: UUID | None = None
    active_flag_id: UUID | None = None
    modalities_enabled_flag_id: UUID | None = None
    temperature_enabled_flag_id: UUID | None = None
    pricing_enabled_flag_id: UUID | None = None
    voices_enabled_flag_id: UUID | None = None
    reasoning_levels_enabled_flag_id: UUID | None = None
    qualities_enabled_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    input_modality_ids: list[UUID] | None = None
    output_modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchModelDraftApiResponse(BaseModel):
    """Response model for patch model draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str

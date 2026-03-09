"""Handcrafted types for model artifact endpoints.

Section-first API following the gold-standard pattern (REFERENCE.md).
Resources: names, descriptions, values, providers, flags, departments,
modalities, temperature_levels, pricing, reasoning_levels, qualities, voices.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.model_create import CreateModelItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection

# =============================================================================
# Flag Config
# =============================================================================


class ModelFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active", "modalities_enabled"
    label: str  # e.g., "Active", "Modalities Enabled"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    generated: bool | None = None


# =============================================================================
# GET Endpoint Types — Section-first API
# =============================================================================


class GetModelApiRequest(BaseModel):
    """Request model for get model endpoint."""

    model_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None


class ModelNameSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ModelDescriptionSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ModelValueSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ModelProviderSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ModelFlagSection(BaseResourceSection):
    current: list[ModelFlagConfig] | None = None
    resources: list[ModelFlagConfig] | None = None


class ModelDepartmentSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ModelModalitySection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ModelTemperatureLevelSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ModelReasoningLevelSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ModelPricingSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ModelQualitySection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ModelVoiceSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class GetModelApiResponse(BaseModel):
    """Section-first response for model editor."""

    actor_name: str | None = None
    model_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    provider_show_ai_generate: bool | None = None
    features_show_ai_generate: bool | None = None

    # Section-first resources
    names: ModelNameSection | None = None
    descriptions: ModelDescriptionSection | None = None
    values: ModelValueSection | None = None
    providers: ModelProviderSection | None = None
    flags: ModelFlagSection | None = None
    departments: ModelDepartmentSection | None = None
    modalities: ModelModalitySection | None = None
    temperature_levels: ModelTemperatureLevelSection | None = None
    pricing: ModelPricingSection | None = None
    reasoning_levels: ModelReasoningLevelSection | None = None
    qualities: ModelQualitySection | None = None
    voices: ModelVoiceSection | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListModelApiModel(BaseModel):
    """Model type for list endpoint with computed permissions."""

    model_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    provider_id: UUID | None = None
    provider_name: str | None = None
    base_url: str | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    active: bool | None = None
    image_model: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListModelApiResponse(BaseModel):
    """Response model for list model endpoint with computed permissions."""

    actor_name: str | None = None
    models: list[ListModelApiModel] | None = None
    provider_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    agent_filter: ListFilterSection | None = None
    total_count: int | None = None


# =============================================================================
# Shared Create/Update Types
# =============================================================================


class ModelFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class ModelResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    model_id: UUID | None = None
    message: str
    errors: list[ModelFieldError] | None = None


# =============================================================================
# Create Endpoint Types
# =============================================================================


class CreateModelApiRequest(BaseModel):
    """Request model for bulk create model endpoint."""

    models: list[CreateModelItem]
    group_id: UUID | None = None


class CreateModelApiResponse(BaseModel):
    """Response model for bulk create model endpoint."""

    results: list[ModelResultItem]


# =============================================================================
# Update Endpoint Types
# =============================================================================


class UpdateModelItem(BaseModel):
    """Single model item for update — model_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    model_id: UUID  # Required — which model to update
    # Dual-mode: name
    name_id: UUID | None = None
    name: str | None = None
    # Dual-mode: description
    description_id: UUID | None = None
    description: str | None = None
    # Dual-mode: departments (match by name)
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # ID-only fields
    flag_ids: list[UUID] | None = None
    modality_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    provider_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None


class UpdateModelApiRequest(BaseModel):
    """Request model for bulk update model endpoint."""

    models: list[UpdateModelItem]
    group_id: UUID | None = None


class UpdateModelApiResponse(BaseModel):
    """Response model for bulk update model endpoint."""

    results: list[ModelResultItem]


class SaveModelFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


# =============================================================================
# DELETE Endpoint Types (unchanged)
# =============================================================================


class DeleteModelApiRequest(BaseModel):
    """Request model for bulk delete model endpoint."""

    model_ids: list[UUID]


class DeleteModelResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    model_id: UUID
    message: str


class DeleteModelApiResponse(BaseModel):
    """Response model for bulk delete model endpoint."""

    results: list[DeleteModelResult]


# =============================================================================
# DUPLICATE Endpoint Types (unchanged)
# =============================================================================


class DuplicateModelApiRequest(BaseModel):
    """Request model for duplicate model endpoint."""

    model_id: UUID


class DuplicateModelApiResponse(BaseModel):
    """Response model for duplicate model endpoint."""

    success: bool
    model_id: UUID
    message: str


# =============================================================================
# DRAFT Endpoint Types (composable infra)
# =============================================================================


class PatchModelDraftApiRequest(BaseModel):
    """Request model for new-style model draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, modality_ids, pricing_ids, provider_ids,
        quality_ids, reasoning_level_ids, temperature_level_ids, value_ids, voice_ids

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
    modality_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    provider_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class ModelDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID]
    department_ids: list[UUID]
    modality_ids: list[UUID]
    pricing_ids: list[UUID]
    provider_ids: list[UUID]
    quality_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    temperature_level_ids: list[UUID]
    value_ids: list[UUID]
    voice_ids: list[UUID]


class PatchModelDraftApiResponse(BaseModel):
    """Response model for new-style model draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: ModelDraftFormState | None = None


# ========== Export Endpoint Types ==========


class ExportModelApiResponse(BaseModel):
    """Response model for export model endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int

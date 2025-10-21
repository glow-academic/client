"""Providers V2 API schemas with hierarchical structure."""

from pydantic import BaseModel

from .base import DepartmentMapping, ProviderMapping

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class ProvidersFilters(BaseModel):
    """Filters for providers list.
    
    Note: Providers are global (not department-specific), so no department filter.
    """

    profileId: str


# ============================================================================
# RESPONSE SCHEMAS - HIERARCHICAL LIST
# ============================================================================


class ModelItem(BaseModel):
    """Model item nested in provider (denormalized)."""

    model_id: str
    name: str
    description: str
    active: bool
    custom_model: bool
    updated_at: str
    can_edit: bool
    can_delete: bool


class ProviderWithModels(BaseModel):
    """Provider with nested models."""

    provider_id: str
    name: str
    description: str
    can_edit: bool
    can_delete: bool
    models: list[ModelItem]


class ProvidersListResponse(BaseModel):
    """Response for providers list endpoint."""

    providers: list[ProviderWithModels]


# ============================================================================
# PROVIDER DETAIL SCHEMAS
# ============================================================================


class ProviderDetailRequest(BaseModel):
    """Request for provider detail."""

    providerId: str
    profileId: str


class ProviderDetailResponse(BaseModel):
    """Response for provider detail endpoint."""

    name: str
    description: str
    api_key: str  # Encrypted - for display only
    base_url: str | None
    department_id: str
    valid_department_ids: list[str]

    # Top-level mappings
    department_mapping: DepartmentMapping


# ============================================================================
# MODEL DETAIL SCHEMAS
# ============================================================================


class ModelDetailRequest(BaseModel):
    """Request for model detail."""

    modelId: str
    providerId: str
    profileId: str


class ModelDetailResponse(BaseModel):
    """Response for model detail endpoint."""

    name: str
    description: str
    active: bool
    custom_model: bool
    input_ppm: float
    output_ppm: float
    provider_id: str

    # Metadata
    valid_provider_ids: list[str]

    # Top-level mappings
    provider_mapping: ProviderMapping


# ============================================================================
# PROVIDER MUTATION SCHEMAS
# ============================================================================


class CreateProviderRequest(BaseModel):
    """Request to create provider."""

    name: str
    description: str
    api_key: str  # Will be encrypted server-side
    base_url: str | None
    department_id: str


class CreateProviderResponse(BaseModel):
    """Response from create provider."""

    success: bool
    providerId: str
    message: str


class UpdateProviderRequest(BaseModel):
    """Request to update provider."""

    providerId: str
    name: str
    description: str
    api_key: str | None = None  # Optional - only update if provided
    base_url: str | None
    department_id: str


class UpdateProviderResponse(BaseModel):
    """Response from update provider."""

    success: bool
    message: str


class DeleteProviderRequest(BaseModel):
    """Request to delete provider."""

    providerId: str


class DeleteProviderResponse(BaseModel):
    """Response from delete provider."""

    success: bool
    message: str


class DuplicateProviderRequest(BaseModel):
    """Request to duplicate provider."""

    providerId: str


class DuplicateProviderResponse(BaseModel):
    """Response from duplicate provider."""

    success: bool
    providerId: str
    message: str


# ============================================================================
# MODEL MUTATION SCHEMAS
# ============================================================================


class CreateModelRequest(BaseModel):
    """Request to create model."""

    provider_id: str
    name: str
    description: str
    active: bool
    custom_model: bool
    input_ppm: float
    output_ppm: float


class CreateModelResponse(BaseModel):
    """Response from create model."""

    success: bool
    modelId: str
    message: str


class UpdateModelRequest(BaseModel):
    """Request to update model."""

    modelId: str
    name: str
    description: str
    active: bool
    custom_model: bool
    input_ppm: float
    output_ppm: float


class UpdateModelResponse(BaseModel):
    """Response from update model."""

    success: bool
    message: str


class DeleteModelRequest(BaseModel):
    """Request to delete model."""

    modelId: str


class DeleteModelResponse(BaseModel):
    """Response from delete model."""

    success: bool
    message: str


class DuplicateModelRequest(BaseModel):
    """Request to duplicate model."""

    modelId: str


class DuplicateModelResponse(BaseModel):
    """Response from duplicate model."""

    success: bool
    modelId: str
    message: str


# ============================================================================
# DECRYPT API KEY SCHEMAS
# ============================================================================


class DecryptProviderKeyRequest(BaseModel):
    """Request to decrypt provider API key."""

    providerId: str
    profileId: str


class DecryptProviderKeyResponse(BaseModel):
    """Response with decrypted API key."""

    api_key: str

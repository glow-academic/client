"""Handcrafted types for model artifact endpoints.

Section-first API following the gold-standard pattern (REFERENCE.md).
Resources: names, descriptions, values, providers, flags, departments,
modalities, temperature_levels, reasoning_levels, qualities, voices.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.drafts.types import DraftModelViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetModalitiesV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetPricingV4Item,
    QGetProvidersV4Item,
    QGetQualitiesV4Item,
    QGetReasoningLevelsV4Item,
    QGetTemperatureLevelsV4Item,
    QGetToolsV4Item,
    QGetValuesV4Item,
    QGetVoicesV4Item,
)

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
# Access Check Types (Query 1) - handcrafted
# =============================================================================


class GetModelAccessSqlParams(BaseModel):
    """Parameters for model access check query."""

    profile_id: UUID
    model_id: UUID | None = None
    draft_id: UUID | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.profile_id, self.model_id, self.draft_id)


class GetModelAccessSqlRow(BaseModel):
    """Row returned from model access check query."""

    actor_name: str | None = None
    model_exists: bool | None = None
    draft_version: int | None = None
    group_id: UUID | None = None
    user_role: str | None = None
    user_department_ids: list[UUID] | None = None
    model_department_ids: list[UUID] | None = None
    active_persona_count: int | None = None


# =============================================================================
# ID Fetching Types (Query 2) - handcrafted
# =============================================================================


class GetModelIdsSqlParams(BaseModel):
    """Parameters for model ID fetching query."""

    profile_id: UUID
    model_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None
    user_department_ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.profile_id,
            self.model_id,
            self.draft_id,
            self.group_id,
            self.user_department_ids,
        )


class GetModelIdsSqlRow(BaseModel):
    """Row returned from model ID fetching query."""

    # Single-select IDs
    name_id: UUID | None = None
    description_id: UUID | None = None
    value_id: UUID | None = None
    provider_id: UUID | None = None

    # Flag IDs
    active_flag_id: UUID | None = None
    modalities_enabled_flag_id: UUID | None = None
    temperature_enabled_flag_id: UUID | None = None
    pricing_enabled_flag_id: UUID | None = None
    voices_enabled_flag_id: UUID | None = None
    reasoning_levels_enabled_flag_id: UUID | None = None
    qualities_enabled_flag_id: UUID | None = None

    # Multi-select IDs
    department_ids: list[UUID] | None = None
    modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None

    # Candidate agents (for Python-side agent scoring)
    candidate_agents: list[dict] | None = None

    # Tools existence flags
    names_has_tools: bool | None = None
    values_has_tools: bool | None = None
    departments_has_tools: bool | None = None
    modalities_has_tools: bool | None = None
    temperature_levels_has_tools: bool | None = None
    pricing_has_tools: bool | None = None
    reasoning_levels_has_tools: bool | None = None
    qualities_has_tools: bool | None = None
    voices_has_tools: bool | None = None

    # Domain IDs
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    value_domain_id: UUID | None = None
    provider_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    modalities_domain_id: UUID | None = None
    temperature_levels_domain_id: UUID | None = None
    pricing_domain_id: UUID | None = None
    reasoning_levels_domain_id: UUID | None = None
    qualities_domain_id: UUID | None = None
    voices_domain_id: UUID | None = None


# =============================================================================
# GET Endpoint Types — Section-first API
# =============================================================================


class GetModelApiRequest(BaseModel):
    """Request model for get model endpoint."""

    model_id: UUID | None = None
    draft_id: UUID | None = None


class BaseResourceSection(BaseModel):
    """Common metadata for model resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ModelNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class ModelDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class ModelValueSection(BaseResourceSection):
    resource: QGetValuesV4Item | None = None
    resources: list[QGetValuesV4Item] | None = None


class ModelProviderSection(BaseResourceSection):
    resource: QGetProvidersV4Item | None = None
    resources: list[QGetProvidersV4Item] | None = None


class ModelFlagSection(BaseResourceSection):
    current: list[ModelFlagConfig] | None = None
    resources: list[ModelFlagConfig] | None = None


class ModelDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class ModelModalitySection(BaseResourceSection):
    current: list[QGetModalitiesV4Item] | None = None
    resources: list[QGetModalitiesV4Item] | None = None


class ModelTemperatureLevelSection(BaseResourceSection):
    current: list[QGetTemperatureLevelsV4Item] | None = None
    resources: list[QGetTemperatureLevelsV4Item] | None = None


class ModelReasoningLevelSection(BaseResourceSection):
    current: list[QGetReasoningLevelsV4Item] | None = None
    resources: list[QGetReasoningLevelsV4Item] | None = None


class ModelPricingSection(BaseResourceSection):
    current: list[QGetPricingV4Item] | None = None
    resources: list[QGetPricingV4Item] | None = None


class ModelQualitySection(BaseResourceSection):
    current: list[QGetQualitiesV4Item] | None = None
    resources: list[QGetQualitiesV4Item] | None = None


class ModelVoiceSection(BaseResourceSection):
    current: list[QGetVoicesV4Item] | None = None
    resources: list[QGetVoicesV4Item] | None = None


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
# Websocket Types
# =============================================================================


class ModelWebsocketViews(BaseModel):
    """Optional websocket views payload."""

    draft_model: DraftModelViewItem | None = None


class ModelWebsocketResources(BaseModel):
    """Hydrated websocket resources: selected model + config resources."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    values: list[QGetValuesV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    flags: list[ModelFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    modalities: list[QGetModalitiesV4Item] | None = None
    temperature_levels: list[QGetTemperatureLevelsV4Item] | None = None
    pricing: list[QGetPricingV4Item] | None = None
    reasoning_levels: list[QGetReasoningLevelsV4Item] | None = None
    qualities: list[QGetQualitiesV4Item] | None = None
    voices: list[QGetVoicesV4Item] | None = None
    # Config resources (for generation agent/model/provider chain)
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetModelWebsocketResponse(BaseModel):
    """Minimal response for model websocket generation handlers."""

    group_id: UUID | None = None
    views: ModelWebsocketViews | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    resources: ModelWebsocketResources


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


class ListModelApiProvider(BaseModel):
    """Provider filter option for list endpoint."""

    provider_id: UUID | None = None
    name: str | None = None
    count: int | None = None


class ListModelApiDepartment(BaseModel):
    """Department filter option for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListModelApiResponse(BaseModel):
    """Response model for list model endpoint with computed permissions."""

    actor_name: str | None = None
    models: list[ListModelApiModel] | None = None
    providers: list[ListModelApiProvider] | None = None
    departments: list[ListModelApiDepartment] | None = None
    total_count: int | None = None


# =============================================================================
# Resource Action Types (for tool call tracking)
# =============================================================================


class ModelResourceAction(BaseModel):
    """Single-select resource action with tool call tracking."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ModelMultiResourceAction(BaseModel):
    """Multi-select resource action with tool call tracking."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class SaveModelApiRequest(BaseModel):
    """Request for saving a model - nested resource actions."""

    group_id: UUID
    input_model_id: UUID | None = None
    names: ModelResourceAction
    descriptions: ModelResourceAction
    values: ModelResourceAction
    providers: ModelResourceAction
    flags: ModelMultiResourceAction
    departments: ModelMultiResourceAction
    modalities: ModelMultiResourceAction
    temperature_levels: ModelMultiResourceAction
    pricing: ModelMultiResourceAction
    reasoning_levels: ModelMultiResourceAction
    qualities: ModelMultiResourceAction
    voices: ModelMultiResourceAction


class SaveModelApiResponse(BaseModel):
    """Response model for save model endpoint."""

    model_id: UUID | None = None
    actor_name: str | None = None


class SaveModelSqlParams(BaseModel):
    """SQL parameters for save model."""

    profile_id: UUID
    input_model_id: UUID | None = None
    group_id: UUID
    names: ModelResourceAction
    descriptions: ModelResourceAction
    values: ModelResourceAction
    providers: ModelResourceAction
    flags: ModelMultiResourceAction
    departments: ModelMultiResourceAction
    modalities: ModelMultiResourceAction
    temperature_levels: ModelMultiResourceAction
    pricing: ModelMultiResourceAction
    reasoning_levels: ModelMultiResourceAction
    qualities: ModelMultiResourceAction
    voices: ModelMultiResourceAction

    @classmethod
    def from_request(
        cls, request: SaveModelApiRequest, profile_id: UUID
    ) -> SaveModelSqlParams:
        return cls(
            profile_id=profile_id,
            input_model_id=request.input_model_id,
            group_id=request.group_id,
            names=request.names,
            descriptions=request.descriptions,
            values=request.values,
            providers=request.providers,
            flags=request.flags,
            departments=request.departments,
            modalities=request.modalities,
            temperature_levels=request.temperature_levels,
            pricing=request.pricing,
            reasoning_levels=request.reasoning_levels,
            qualities=request.qualities,
            voices=request.voices,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: ModelResourceAction,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(
            a: ModelMultiResourceAction,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_model_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.values),
            single(self.providers),
            multi(self.flags),
            multi(self.departments),
            multi(self.modalities),
            multi(self.temperature_levels),
            multi(self.pricing),
            multi(self.reasoning_levels),
            multi(self.qualities),
            multi(self.voices),
        )


class SaveModelSqlRow(BaseModel):
    """SQL row for save model."""

    model_id: UUID | None = None
    actor_name: str | None = None


# =============================================================================
# DELETE Endpoint Types (unchanged)
# =============================================================================


class DeleteModelApiRequest(BaseModel):
    """Request model for delete model endpoint."""

    model_id: UUID


class DeleteModelApiResponse(BaseModel):
    """Response model for delete model endpoint."""

    success: bool
    message: str


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
# DRAFT Endpoint Types
# =============================================================================


class PatchModelDraftApiRequest(BaseModel):
    """Request for patching a model draft - nested resource actions."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ModelResourceAction | None = None
    descriptions: ModelResourceAction | None = None
    values: ModelResourceAction | None = None
    providers: ModelResourceAction | None = None
    flags: ModelMultiResourceAction | None = None
    departments: ModelMultiResourceAction | None = None
    modalities: ModelMultiResourceAction | None = None
    temperature_levels: ModelMultiResourceAction | None = None
    pricing: ModelMultiResourceAction | None = None
    reasoning_levels: ModelMultiResourceAction | None = None
    qualities: ModelMultiResourceAction | None = None
    voices: ModelMultiResourceAction | None = None
    expected_version: int | None = 0


class PatchModelDraftApiResponse(BaseModel):
    """Response model for patch model draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchModelDraftSqlParams(BaseModel):
    """SQL parameters for patch model draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ModelResourceAction | None = None
    descriptions: ModelResourceAction | None = None
    values: ModelResourceAction | None = None
    providers: ModelResourceAction | None = None
    flags: ModelMultiResourceAction | None = None
    departments: ModelMultiResourceAction | None = None
    modalities: ModelMultiResourceAction | None = None
    temperature_levels: ModelMultiResourceAction | None = None
    pricing: ModelMultiResourceAction | None = None
    reasoning_levels: ModelMultiResourceAction | None = None
    qualities: ModelMultiResourceAction | None = None
    voices: ModelMultiResourceAction | None = None
    expected_version: int | None = 0

    @classmethod
    def from_request(
        cls, request: PatchModelDraftApiRequest, profile_id: UUID
    ) -> PatchModelDraftSqlParams:
        _empty_single = ModelResourceAction()
        _empty_multi = ModelMultiResourceAction()
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=request.names or _empty_single,
            descriptions=request.descriptions or _empty_single,
            values=request.values or _empty_single,
            providers=request.providers or _empty_single,
            flags=request.flags or _empty_multi,
            departments=request.departments or _empty_multi,
            modalities=request.modalities or _empty_multi,
            temperature_levels=request.temperature_levels or _empty_multi,
            pricing=request.pricing or _empty_multi,
            reasoning_levels=request.reasoning_levels or _empty_multi,
            qualities=request.qualities or _empty_multi,
            voices=request.voices or _empty_multi,
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: ModelResourceAction | None,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (
                (a.resource_id, a.create_tool_id, a.link_tool_id)
                if a
                else (None, None, None)
            )

        def multi(
            a: ModelMultiResourceAction | None,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (
                (a.resource_ids, a.create_tool_id, a.link_tool_id)
                if a
                else (None, None, None)
            )

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.values),
            single(self.providers),
            multi(self.flags),
            multi(self.departments),
            multi(self.modalities),
            multi(self.temperature_levels),
            multi(self.pricing),
            multi(self.reasoning_levels),
            multi(self.qualities),
            multi(self.voices),
            self.expected_version,
        )

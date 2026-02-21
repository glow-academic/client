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

from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetModalitiesV4Item,
    QGetModelDraftsEntriesV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetPricingV4Item,
    QGetProfilesV4Item,
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

    draft_model: QGetModelDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


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
    config_args: list[QGetArgsV4Item] | None = None
    config_args_outputs: list[QGetArgsOutputsV4Item] | None = None
    # Profile config (for rate limiting)
    config_profile: list[QGetProfilesV4Item] | None = None


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


class ListModelApiResponse(BaseModel):
    """Response model for list model endpoint with computed permissions."""

    actor_name: str | None = None
    models: list[ListModelApiModel] | None = None
    provider_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    agent_filter: ListFilterSection | None = None
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
    """Flat-ID save request for model endpoint."""

    input_model_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    value_id: UUID | None = None
    provider_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


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
        cls,
        request: SaveModelApiRequest,
        profile_id: UUID,
        group_id: UUID,
    ) -> SaveModelSqlParams:
        return cls(
            profile_id=profile_id,
            input_model_id=request.input_model_id,
            group_id=group_id,
            names=ModelResourceAction(resource_id=request.name_id),
            descriptions=ModelResourceAction(resource_id=request.description_id),
            values=ModelResourceAction(resource_id=request.value_id),
            providers=ModelResourceAction(resource_id=request.provider_id),
            flags=ModelMultiResourceAction(resource_ids=request.flag_ids),
            departments=ModelMultiResourceAction(resource_ids=request.department_ids),
            modalities=ModelMultiResourceAction(resource_ids=request.modality_ids),
            temperature_levels=ModelMultiResourceAction(
                resource_ids=request.temperature_level_ids
            ),
            pricing=ModelMultiResourceAction(resource_ids=request.pricing_ids),
            reasoning_levels=ModelMultiResourceAction(
                resource_ids=request.reasoning_level_ids
            ),
            qualities=ModelMultiResourceAction(resource_ids=request.quality_ids),
            voices=ModelMultiResourceAction(resource_ids=request.voice_ids),
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
    """Flat-ID patch draft request for model endpoint."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    value_id: UUID | None = None
    provider_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
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
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=ModelResourceAction(resource_id=request.name_id),
            descriptions=ModelResourceAction(resource_id=request.description_id),
            values=ModelResourceAction(resource_id=request.value_id),
            providers=ModelResourceAction(resource_id=request.provider_id),
            flags=ModelMultiResourceAction(resource_ids=request.flag_ids),
            departments=ModelMultiResourceAction(resource_ids=request.department_ids),
            modalities=ModelMultiResourceAction(resource_ids=request.modality_ids),
            temperature_levels=ModelMultiResourceAction(
                resource_ids=request.temperature_level_ids
            ),
            pricing=ModelMultiResourceAction(resource_ids=request.pricing_ids),
            reasoning_levels=ModelMultiResourceAction(
                resource_ids=request.reasoning_level_ids
            ),
            qualities=ModelMultiResourceAction(resource_ids=request.quality_ids),
            voices=ModelMultiResourceAction(resource_ids=request.voice_ids),
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

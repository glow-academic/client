"""Handcrafted types for agent endpoints (section-first contracts)."""

from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftAgentViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetInstructionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetPromptsV4Item,
    QGetProvidersV4Item,
    QGetReasoningLevelsV4Item,
    QGetTemperatureLevelsV4Item,
    QGetToolsV4Item,
    QGetVoicesV4Item,
)


class AgentFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class BaseResourceSection(BaseModel):
    """Common metadata fields for all resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class AgentNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class AgentDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class AgentModelSection(BaseResourceSection):
    resource: QGetModelsV4Item | None = None
    resources: list[QGetModelsV4Item] | None = None


class AgentPromptSection(BaseResourceSection):
    resource: QGetPromptsV4Item | None = None
    resources: list[QGetPromptsV4Item] | None = None


class AgentInstructionSection(BaseResourceSection):
    resource: QGetInstructionsV4Item | None = None
    resources: list[QGetInstructionsV4Item] | None = None


class AgentFlagSection(BaseResourceSection):
    current: list[AgentFlagConfig] | None = None
    resources: list[AgentFlagConfig] | None = None


class AgentDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class AgentToolSection(BaseResourceSection):
    current: list[QGetToolsV4Item] | None = None
    resources: list[QGetToolsV4Item] | None = None


class AgentTemperatureLevelSection(BaseResourceSection):
    resource: QGetTemperatureLevelsV4Item | None = None
    resources: list[QGetTemperatureLevelsV4Item] | None = None


class AgentReasoningLevelSection(BaseResourceSection):
    resource: QGetReasoningLevelsV4Item | None = None
    resources: list[QGetReasoningLevelsV4Item] | None = None


class AgentVoiceSection(BaseResourceSection):
    current: list[QGetVoicesV4Item] | None = None
    resources: list[QGetVoicesV4Item] | None = None


class GetAgentApiRequest(BaseModel):
    """Request model for get agent endpoint."""

    agent_id: UUID | None = None
    draft_id: UUID | None = None


class GetAgentApiResponse(BaseModel):
    """Section-first response model for get agent endpoint."""

    actor_name: str | None = None
    agent_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    general_show_ai_generate: bool | None = None

    names: AgentNameSection | None = None
    descriptions: AgentDescriptionSection | None = None
    models: AgentModelSection | None = None
    prompts: AgentPromptSection | None = None
    instructions: AgentInstructionSection | None = None
    flags: AgentFlagSection | None = None
    departments: AgentDepartmentSection | None = None
    tools: AgentToolSection | None = None
    temperature_levels: AgentTemperatureLevelSection | None = None
    reasoning_levels: AgentReasoningLevelSection | None = None
    voices: AgentVoiceSection | None = None


class AgentWebsocketViews(BaseModel):
    """Views data for websocket response."""

    draft_agent: DraftAgentViewItem | None = None


class AgentWebsocketResources(BaseModel):
    """Hydrated selected resources for websocket generation."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    prompts: list[QGetPromptsV4Item] | None = None
    instructions: list[QGetInstructionsV4Item] | None = None
    flags: list[AgentFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    temperature_levels: list[QGetTemperatureLevelsV4Item] | None = None
    reasoning_levels: list[QGetReasoningLevelsV4Item] | None = None
    voices: list[QGetVoicesV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None


class GetAgentWebsocketResponse(BaseModel):
    """WebSocket response shape for agent generation."""

    views: AgentWebsocketViews | None = None
    resources: AgentWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class AgentResourceBucket(BaseModel):
    """Internal resources bucket with full and current objects."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    prompts: list[QGetPromptsV4Item] | None = None
    instructions: list[QGetInstructionsV4Item] | None = None
    flags: list[AgentFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    temperature_levels: list[QGetTemperatureLevelsV4Item] | None = None
    reasoning_levels: list[QGetReasoningLevelsV4Item] | None = None
    voices: list[QGetVoicesV4Item] | None = None


class AgentResources(BaseModel):
    """Internal resources payload with full + selected buckets."""

    resources: AgentResourceBucket | None = None
    current: AgentResourceBucket | None = None


class AgentResourceAction(BaseModel):
    """Single-select action payload."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class AgentMultiResourceAction(BaseModel):
    """Multi-select action payload."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveAgentApiRequest(BaseModel):
    """Section-action save request for agent endpoint."""

    group_id: UUID
    input_agent_id: UUID | None = None
    names: AgentResourceAction
    models: AgentResourceAction
    descriptions: AgentResourceAction | None = None
    prompts: AgentResourceAction | None = None
    instructions: AgentResourceAction | None = None
    flags: AgentResourceAction | None = None
    temperature_levels: AgentResourceAction | None = None
    reasoning_levels: AgentResourceAction | None = None
    departments: AgentMultiResourceAction | None = None
    tools: AgentMultiResourceAction | None = None
    voices: AgentMultiResourceAction | None = None


class SaveAgentApiResponse(BaseModel):
    """Response model for save agent endpoint."""

    success: bool
    agent_id: UUID
    message: str


class DeleteAgentApiRequest(BaseModel):
    """Request model for delete agent endpoint."""

    agent_id: UUID


class DeleteAgentApiResponse(BaseModel):
    """Response model for delete agent endpoint."""

    success: bool
    message: str


class DuplicateAgentApiRequest(BaseModel):
    """Request model for duplicate agent endpoint."""

    agent_id: UUID


class DuplicateAgentApiResponse(BaseModel):
    """Response model for duplicate agent endpoint."""

    success: bool
    agent_id: UUID
    message: str


class PatchAgentDraftApiRequest(BaseModel):
    """Section-action patch draft request for agent endpoint."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: AgentResourceAction | None = None
    descriptions: AgentResourceAction | None = None
    models: AgentResourceAction | None = None
    prompts: AgentResourceAction | None = None
    instructions: AgentResourceAction | None = None
    flags: AgentResourceAction | None = None
    temperature_levels: AgentResourceAction | None = None
    reasoning_levels: AgentResourceAction | None = None
    departments: AgentMultiResourceAction | None = None
    tools: AgentMultiResourceAction | None = None
    voices: AgentMultiResourceAction | None = None
    expected_version: int = 0


class PatchAgentDraftApiResponse(BaseModel):
    """Response model for patch agent draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== List Endpoint Types ==========


class ListAgentApiAgent(BaseModel):
    """Agent type for list endpoint with computed permissions."""

    agent_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    reasoning: str | None = None
    temperature: float | None = None
    model_id: UUID | None = None
    model_name: str | None = None
    model_description: str | None = None
    role: str | None = None
    updated_at: dt.datetime | None = None
    department_ids: list[str] | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListAgentApiDepartment(BaseModel):
    """Department filter option for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListAgentApiModel(BaseModel):
    """Model filter option for list endpoint."""

    model_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListAgentApiResponse(BaseModel):
    """Response model for list agent endpoint."""

    actor_name: str | None = None
    agents: list[ListAgentApiAgent] | None = None
    departments: list[ListAgentApiDepartment] | None = None
    models: list[ListAgentApiModel] | None = None
    total_count: int | None = None

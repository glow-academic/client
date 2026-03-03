"""Handcrafted types for agent endpoints (section-first contracts)."""

from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetAgentDraftsEntriesV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetInstructionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetPromptsV4Item,
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
    # Optional group_id from layout context (avoids server-side creation)
    group_id: UUID | None = None


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


class AgentWebsocketEntries(BaseModel):
    """Entries data for websocket response."""

    draft_agent: QGetAgentDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class AgentWebsocketResources(BaseModel):
    """Hydrated selected resources for websocket generation."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    prompts: list[QGetPromptsV4Item] | None = None
    instructions: list[QGetInstructionsV4Item] | None = None
    flags: list[AgentFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    temperature_levels: list[QGetTemperatureLevelsV4Item] | None = None
    reasoning_levels: list[QGetReasoningLevelsV4Item] | None = None
    voices: list[QGetVoicesV4Item] | None = None


class GetAgentWebsocketResponse(InternalResponseBase):
    """WebSocket response shape for agent generation."""

    entries: AgentWebsocketEntries | None = None
    resources: AgentWebsocketResources


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
    """Flat-ID save request for agent endpoint."""

    input_agent_id: UUID | None = None
    name_id: UUID
    model_id: UUID
    description_id: UUID | None = None
    prompt_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    temperature_level_id: UUID | None = None
    reasoning_level_id: UUID | None = None
    department_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class SaveAgentApiResponse(BaseModel):
    """Response model for save agent endpoint."""

    agent_id: UUID
    actor_name: str | None = None


class SaveAgentSqlParams(BaseModel):
    """SQL parameters for save agent - builds composites from flat IDs."""

    profile_id: UUID
    input_agent_id: UUID | None = None
    group_id: UUID | None = None
    names: AgentResourceAction
    descriptions: AgentResourceAction
    models: AgentResourceAction
    prompts: AgentResourceAction
    instructions: AgentResourceAction
    flags: AgentResourceAction
    temperature_levels: AgentResourceAction
    reasoning_levels: AgentResourceAction
    departments: AgentMultiResourceAction
    tools: AgentMultiResourceAction
    voices: AgentMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveAgentApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveAgentSqlParams:
        return cls(
            profile_id=profile_id,
            input_agent_id=request.input_agent_id,
            group_id=group_id,
            names=AgentResourceAction(resource_id=request.name_id),
            descriptions=AgentResourceAction(resource_id=request.description_id),
            models=AgentResourceAction(resource_id=request.model_id),
            prompts=AgentResourceAction(resource_id=request.prompt_id),
            instructions=AgentResourceAction(resource_id=request.instructions_id),
            flags=AgentResourceAction(resource_id=request.active_flag_id),
            temperature_levels=AgentResourceAction(
                resource_id=request.temperature_level_id
            ),
            reasoning_levels=AgentResourceAction(
                resource_id=request.reasoning_level_id
            ),
            departments=AgentMultiResourceAction(resource_ids=request.department_ids),
            tools=AgentMultiResourceAction(resource_ids=request.tool_ids),
            voices=AgentMultiResourceAction(resource_ids=request.voice_ids),
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""

        def single(a: AgentResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: AgentMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_agent_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.models),
            single(self.prompts),
            single(self.instructions),
            single(self.flags),
            single(self.temperature_levels),
            single(self.reasoning_levels),
            multi(self.departments),
            multi(self.tools),
            multi(self.voices),
        )


class SaveAgentSqlRow(BaseModel):
    """SQL row for save agent."""

    agent_id: UUID | None = None


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
    """Flat-ID patch draft request for agent endpoint."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    model_id: UUID | None = None
    description_id: UUID | None = None
    prompt_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    temperature_level_id: UUID | None = None
    reasoning_level_id: UUID | None = None
    department_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
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


class ListAgentApiResponse(BaseModel):
    """Response model for list agent endpoint."""

    actor_name: str | None = None
    agents: list[ListAgentApiAgent] | None = None
    department_filter: ListFilterSection | None = None
    model_filter: ListFilterSection | None = None
    tool_filter: ListFilterSection | None = None
    total_count: int | None = None

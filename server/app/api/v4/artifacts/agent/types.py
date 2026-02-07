"""Handcrafted types for agent GET endpoint."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
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

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class AgentFlagConfig(BaseModel):
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


class GetAgentApiRequest(BaseModel):
    """Request model for get agent endpoint."""

    agent_id: UUID | None = None
    draft_id: UUID | None = None


class GetAgentApiResponse(BaseModel):
    """Response model for get agent endpoint."""

    # Required fields
    actor_name: str | None = None
    agent_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    models_group_id: UUID | None = None
    prompts_group_id: UUID | None = None
    instructions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    tools_group_id: UUID | None = None
    temperature_levels_group_id: UUID | None = None
    reasoning_levels_group_id: UUID | None = None
    voices_group_id: UUID | None = None

    # Single-select resources: name
    show_name: bool | None = None
    name_domain_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    name_show_ai_generate: bool | None = None

    # Single-select resources: description
    show_description: bool | None = None
    descriptions_domain_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions_show_ai_generate: bool | None = None

    # Single-select resources: model
    show_models: bool | None = None
    models_domain_id: UUID | None = None
    models_required: bool | None = None
    model_suggestions: list[UUID] | None = None
    models_show_ai_generate: bool | None = None

    # Single-select resources: prompt
    show_prompts: bool | None = None
    prompts_domain_id: UUID | None = None
    prompts_required: bool | None = None
    prompt_suggestions: list[UUID] | None = None
    prompts_show_ai_generate: bool | None = None

    # Single-select resources: instructions
    show_instructions: bool | None = None
    instructions_domain_id: UUID | None = None
    instructions_required: bool | None = None
    instructions_suggestions: list[UUID] | None = None
    instructions_show_ai_generate: bool | None = None

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

    # Multi-select resources: tools
    show_tools: bool | None = None
    tools_domain_id: UUID | None = None
    tools_required: bool | None = None
    tool_suggestions: list[UUID] | None = None
    tools_show_ai_generate: bool | None = None

    # Single-select resources: temperature_levels
    show_temperature_levels: bool | None = None
    temperature_levels_domain_id: UUID | None = None
    temperature_levels_required: bool | None = None
    temperature_level_suggestions: list[UUID] | None = None
    temperature_levels_show_ai_generate: bool | None = None

    # Single-select resources: reasoning_levels
    show_reasoning_levels: bool | None = None
    reasoning_levels_domain_id: UUID | None = None
    reasoning_levels_required: bool | None = None
    reasoning_level_suggestions: list[UUID] | None = None
    reasoning_levels_show_ai_generate: bool | None = None

    # Multi-select resources: voices
    show_voices: bool | None = None
    voices_domain_id: UUID | None = None
    voices_required: bool | None = None
    voice_suggestions: list[UUID] | None = None
    voices_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    general_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    descriptions_create_tool_id: UUID | None = None
    models_create_tool_id: UUID | None = None
    prompts_create_tool_id: UUID | None = None
    instructions_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    descriptions_link_tool_id: UUID | None = None
    models_link_tool_id: UUID | None = None
    prompts_link_tool_id: UUID | None = None
    instructions_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    tools_link_tool_id: UUID | None = None
    temperature_levels_link_tool_id: UUID | None = None
    reasoning_levels_link_tool_id: UUID | None = None
    voices_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: AgentResources | None = None


class GetAgentWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_agent_websocket).

    Contains only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    descriptions_domain_id: UUID | None = None
    models_domain_id: UUID | None = None
    prompts_domain_id: UUID | None = None
    instructions_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    tools_domain_id: UUID | None = None
    temperature_levels_domain_id: UUID | None = None
    reasoning_levels_domain_id: UUID | None = None
    voices_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: AgentResources | None = None


class AgentResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

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
    """Full resources + current selections."""

    resources: AgentResourceBucket | None = None
    current: AgentResourceBucket | None = None


# ========== Save Endpoint Types ==========


class SaveAgentApiRequest(BaseModel):
    """Request model for save agent endpoint - accepts resource IDs."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_agent_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED
    model_id: UUID  # REQUIRED - model_artifact.id

    # Optional single-select resources
    description_id: UUID | None = None
    prompt_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    temperature_level_id: UUID | None = None
    reasoning_level_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class SaveAgentApiResponse(BaseModel):
    """Response model for save agent endpoint."""

    success: bool
    agent_id: UUID
    message: str


class SaveAgentSqlParams(BaseModel):
    """SQL parameters for save agent - accepts resource IDs."""

    # Context
    profile_id: UUID  # Added from header (actor)
    group_id: UUID  # REQUIRED
    input_agent_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED
    model_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    prompt_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    temperature_level_id: UUID | None = None
    reasoning_level_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_agent_id,
            self.name_id,
            self.model_id,
            self.description_id,
            self.prompt_id,
            self.instructions_id,
            self.active_flag_id,
            self.temperature_level_id,
            self.reasoning_level_id,
            self.department_ids,
            self.tool_ids,
            self.voice_ids,
        )


class SaveAgentSqlRow(BaseModel):
    """SQL row for save agent."""

    agent_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteAgentApiRequest(BaseModel):
    """Request model for delete agent endpoint."""

    agent_id: UUID


class DeleteAgentApiResponse(BaseModel):
    """Response model for delete agent endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateAgentApiRequest(BaseModel):
    """Request model for duplicate agent endpoint."""

    agent_id: UUID


class DuplicateAgentApiResponse(BaseModel):
    """Response model for duplicate agent endpoint."""

    success: bool
    agent_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchAgentDraftApiRequest(BaseModel):
    """Request model for patch agent draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    model_id: UUID | None = None
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

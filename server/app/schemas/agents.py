"""Agents V2 API schemas."""

from pydantic import BaseModel

from .base import ModelMapping, ReasoningMapping

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class AgentsListRequest(BaseModel):
    """Request for agents list."""

    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class AgentItem(BaseModel):
    """Agent item for list view."""

    agent_id: str
    name: str
    description: str
    reasoning: str | None
    temperature: float
    model_id: str
    updated_at: str
    can_edit: bool
    can_duplicate: bool
    can_delete: bool


class AgentsListResponse(BaseModel):
    """Response for agents list."""

    agents: list[AgentItem]
    model_mapping: ModelMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class AgentDetailRequest(BaseModel):
    """Request for agent detail."""

    agentId: str
    profileId: str


class AgentDetailDefaultRequest(BaseModel):
    """Request for default agent detail."""

    profileId: str


class DebugInfoItem(BaseModel):
    """Debug information item."""

    created_at: str
    model_id: str
    content: str


class AgentDetailResponse(BaseModel):
    """Response for agent detail."""

    # Basic fields
    name: str
    description: str
    system_prompt: str
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool

    # Metadata
    valid_model_ids: list[str]
    reasoning_options: list[str]
    temperature_lower: float
    temperature_upper: float

    # Debug info
    debug_info: list[DebugInfoItem]

    # Mappings
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class CreateAgentRequest(BaseModel):
    """Request for creating an agent."""

    name: str
    description: str
    system_prompt: str
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool


class CreateAgentResponse(BaseModel):
    """Response for creating an agent."""

    success: bool
    agentId: str
    message: str


class UpdateAgentRequest(BaseModel):
    """Request for updating an agent."""

    agentId: str
    name: str
    description: str
    system_prompt: str
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool


class UpdateAgentResponse(BaseModel):
    """Response for updating an agent."""

    success: bool
    message: str


class DuplicateAgentRequest(BaseModel):
    """Request for duplicating an agent."""

    agentId: str


class DuplicateAgentResponse(BaseModel):
    """Response for duplicating an agent."""

    success: bool
    agentId: str
    message: str


class DeleteAgentRequest(BaseModel):
    """Request for deleting an agent."""

    agentId: str


class DeleteAgentResponse(BaseModel):
    """Response for deleting an agent."""

    success: bool
    message: str

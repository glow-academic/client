"""Agents V2 API schemas."""

from typing import List, Optional

from pydantic import BaseModel

from .base import ModelMapping

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
    reasoning: Optional[str]
    temperature: float
    model_id: str
    updated_at: str
    can_edit: bool
    can_delete: bool


class AgentsListResponse(BaseModel):
    """Response for agents list."""

    agents: List[AgentItem]
    model_mapping: ModelMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class AgentDetailRequest(BaseModel):
    """Request for agent detail."""

    agentId: str
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
    reasoning: Optional[str]

    # Metadata
    valid_model_ids: List[str]
    reasoning_options: List[str]
    temperature_lower: float
    temperature_upper: float

    # Debug info
    debug_info: List[DebugInfoItem]

    # Mappings
    model_mapping: ModelMapping


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
    reasoning: Optional[str]


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
    reasoning: Optional[str]


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


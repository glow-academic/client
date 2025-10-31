"""Agents V2 API schemas."""

from pydantic import BaseModel

from .base import DepartmentMapping, ModelMapping, ReasoningMapping

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
    role: str
    department_ids: list[str] | None
    updated_at: str
    can_edit: bool
    can_duplicate: bool
    can_delete: bool


class AgentsListResponse(BaseModel):
    """Response for agents list."""

    agents: list[AgentItem]
    model_mapping: ModelMapping
    department_mapping: DepartmentMapping


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


class PromptInfo(BaseModel):
    """Prompt information for version history."""

    system_prompt: str
    created_at: str
    updated_at: str
    department_ids: list[str] | None


class AgentDetailResponse(BaseModel):
    """Response for agent detail."""

    # Basic fields
    name: str
    description: str
    system_prompt: str
    prompt_id: str | None
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool
    role: str  # agent_role enum value

    # Metadata
    valid_model_ids: list[str]
    reasoning_options: list[str]
    temperature_lower: float
    temperature_upper: float

    # Department associations
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping

    # Prompt version history
    prompt_mapping: dict[str, PromptInfo]

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
    prompt_id: str | None  # If provided, use existing prompt
    system_prompt: str  # If prompt_id is None, create new prompt with this
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool
    role: str  # agent_role enum value
    department_ids: list[str] | None  # None = cross-department (superadmin only)


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
    prompt_id: str | None  # If provided, use existing prompt
    system_prompt: str  # If prompt_id is None, create new prompt with this
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool
    role: str  # agent_role enum value
    department_ids: list[str] | None  # None = cross-department (superadmin only)


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

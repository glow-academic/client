"""Handcrafted types for agent endpoints (section-first contracts)."""

from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.agent_create import CreateAgentItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection


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
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentDescriptionSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentModelSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentPromptSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentInstructionSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentFlagSection(BaseResourceSection):
    current: list[AgentFlagConfig] | None = None
    resources: list[AgentFlagConfig] | None = None


class AgentDepartmentSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class AgentToolSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class AgentTemperatureLevelSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentReasoningLevelSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class AgentVoiceSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class AgentQualitySection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class AgentRubricSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class GetAgentApiRequest(BaseModel):
    """Request model for get agent endpoint."""

    agent_id: UUID | None = None
    draft_id: UUID | None = None
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
    qualities: AgentQualitySection | None = None
    rubrics: AgentRubricSection | None = None


# ========== Shared Create/Update Types ==========


class AgentFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class AgentResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    agent_id: UUID | None = None
    message: str
    errors: list[AgentFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateAgentApiRequest(BaseModel):
    """Request model for bulk create agent endpoint."""

    agents: list[CreateAgentItem]
    group_id: UUID | None = None


class CreateAgentApiResponse(BaseModel):
    """Response model for bulk create agent endpoint."""

    results: list[AgentResultItem]


# ========== Update Endpoint Types ==========


class UpdateAgentItem(BaseModel):
    """Single agent item for update — agent_id required, all fields optional."""

    agent_id: UUID  # Required — which agent to update
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
    model_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    agent_ids: list[UUID] | None = None


class UpdateAgentApiRequest(BaseModel):
    """Request model for bulk update agent endpoint."""

    agents: list[UpdateAgentItem]
    group_id: UUID | None = None


class UpdateAgentApiResponse(BaseModel):
    """Response model for bulk update agent endpoint."""

    results: list[AgentResultItem]


class SaveAgentFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DeleteAgentApiRequest(BaseModel):
    """Request model for bulk delete agent endpoint."""

    agent_ids: list[UUID]


class DeleteAgentResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    agent_id: UUID
    message: str


class DeleteAgentApiResponse(BaseModel):
    """Response model for bulk delete agent endpoint."""

    results: list[DeleteAgentResult]


class DuplicateAgentApiRequest(BaseModel):
    """Request model for duplicate agent endpoint."""

    agent_id: UUID


class DuplicateAgentApiResponse(BaseModel):
    """Response model for duplicate agent endpoint."""

    success: bool
    agent_id: UUID
    message: str


class PatchAgentDraftApiRequest(BaseModel):
    """Request model for new-style agent draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, model_ids, tool_ids, reasoning_level_ids,
        temperature_level_ids, voice_ids, rubric_ids

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
    model_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None


class AgentDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID]
    department_ids: list[UUID]
    model_ids: list[UUID]
    tool_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    temperature_level_ids: list[UUID]
    voice_ids: list[UUID]
    rubric_ids: list[UUID]


class PatchAgentDraftApiResponse(BaseModel):
    """Response model for new-style agent draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: AgentDraftFormState | None = None


# ========== List Endpoint Types ==========


# ========== Export Endpoint Types ==========


class ExportAgentApiRequest(BaseModel):
    """Request model for export agent endpoint."""

    agent_id: UUID | None = None


class ExportAgentApiResponse(BaseModel):
    """Response model for export agent endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


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

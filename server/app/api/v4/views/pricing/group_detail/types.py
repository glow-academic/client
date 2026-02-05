"""Types for pricing group detail view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GroupDetailContent(BaseModel):
    """Single content block within a message."""

    content: str | None = None


class GroupDetailCall(BaseModel):
    """A tool/function call made during the run."""

    id: UUID
    template_name: str | None = None
    arguments: str | None = None
    created_at: datetime


class GroupDetailMessage(BaseModel):
    """Single message with contents and run origin info."""

    id: UUID | None = None
    role: str | None = None
    contents: list[GroupDetailContent] = Field(default_factory=list)
    calls: list[GroupDetailCall] = Field(default_factory=list)
    run_idx: int = 0


class GroupDetailRunMetadata(BaseModel):
    """Run-level metadata from mv_pricing_run_facts."""

    id: UUID
    created_at: datetime
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    cost: float = 0
    model_id: UUID | None = None
    agent_id: UUID | None = None
    profile_id: UUID | None = None


class GroupDetailRunWithMessages(BaseModel):
    """A run with its ordered messages and context boundary."""

    run: GroupDetailRunMetadata
    messages: list[GroupDetailMessage] = Field(default_factory=list)
    previous_context_start_index: int | None = None


class GetGroupDetailResponse(BaseModel):
    """Views-layer response for group detail."""

    group_exists: bool = False
    runs: list[GroupDetailRunWithMessages] = Field(default_factory=list)

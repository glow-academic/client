"""Types for simulation groups view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GroupViewItem(BaseModel):
    """Single group from the simulation groups view (inference config)."""

    # Primary key (entry ID)
    group_id: UUID

    # Resource ID (for client hydration - one hop away)
    groups_id: UUID | None = None

    # Inference config resource IDs (one hop to hydrate)
    agents_id: UUID | None = None
    models_id: UUID | None = None
    model_values_id: UUID | None = None
    providers_id: UUID | None = None
    provider_values_id: UUID | None = None
    endpoints_id: UUID | None = None
    keys_id: UUID | None = None
    prompts_id: UUID | None = None
    instructions_ids: list[UUID] | None = None
    temperature_levels_id: UUID | None = None
    reasoning_levels_id: UUID | None = None
    qualities_id: UUID | None = None
    voices_id: UUID | None = None
    tools_ids: list[UUID] | None = None

    # Direct fields
    custom_model: bool | None = None
    group_name: str | None = None
    trace_id: str | None = None
    created_at: datetime | None = None


class GetGroupsRequest(BaseModel):
    """Request for getting group data."""

    chat_id: UUID = Field(description="Chat ID to fetch groups for")


class GetGroupsResponse(BaseModel):
    """Response containing group data."""

    items: list[GroupViewItem] = Field(
        default_factory=list, description="Group data items"
    )

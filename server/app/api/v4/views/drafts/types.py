"""Types for drafts resources view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DraftResourcesViewItem(BaseModel):
    """Single draft row from mv_draft_resources."""

    draft_id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    version: int = 0
    generated: bool = False
    mcp: bool = False
    active: bool = True

    # groups_resource id (as requested by UI contract)
    group_id: UUID | None = None

    resource_types: list[str] = Field(default_factory=list)
    resource_ids: list[UUID] = Field(default_factory=list)

    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    auth_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    field_ids: list[UUID] = Field(default_factory=list)
    question_ids: list[UUID] = Field(default_factory=list)
    template_ids: list[UUID] = Field(default_factory=list)
    text_ids: list[UUID] = Field(default_factory=list)
    run_rubric_ids: list[UUID] = Field(default_factory=list)
    group_rubric_ids: list[UUID] = Field(default_factory=list)
    binding_ids: list[UUID] = Field(default_factory=list)
    conditional_parameter_ids: list[UUID] = Field(default_factory=list)
    persona_ids: list[UUID] = Field(default_factory=list)
    scenario_ids: list[UUID] = Field(default_factory=list)
    simulation_ids: list[UUID] = Field(default_factory=list)


class GetDraftResourcesRequest(BaseModel):
    """Request for getting draft resources view rows."""

    draft_ids: list[UUID] = Field(
        default_factory=list,
        description="Optional draft IDs to fetch. Empty list returns all rows.",
    )


class GetDraftResourcesResponse(BaseModel):
    """Response containing draft resources view rows."""

    items: list[DraftResourcesViewItem] = Field(default_factory=list)

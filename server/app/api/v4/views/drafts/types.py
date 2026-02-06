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

    # Per-resource group IDs (groups_resource.id for each resource type)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    colors_group_id: UUID | None = None
    icons_group_id: UUID | None = None
    auths_group_id: UUID | None = None
    tools_group_id: UUID | None = None
    instructions_group_id: UUID | None = None
    documents_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    parameters_group_id: UUID | None = None
    parameter_fields_group_id: UUID | None = None
    fields_group_id: UUID | None = None
    examples_group_id: UUID | None = None
    questions_group_id: UUID | None = None
    templates_group_id: UUID | None = None
    texts_group_id: UUID | None = None
    run_rubrics_group_id: UUID | None = None
    group_rubrics_group_id: UUID | None = None
    bindings_group_id: UUID | None = None
    conditional_parameters_group_id: UUID | None = None
    personas_group_id: UUID | None = None
    scenarios_group_id: UUID | None = None
    simulations_group_id: UUID | None = None

    resource_types: list[str] = Field(default_factory=list)
    resource_ids: list[UUID] = Field(default_factory=list)

    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    color_ids: list[UUID] = Field(default_factory=list)
    icon_ids: list[UUID] = Field(default_factory=list)
    auth_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    field_ids: list[UUID] = Field(default_factory=list)
    example_ids: list[UUID] = Field(default_factory=list)
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

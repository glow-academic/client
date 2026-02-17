"""Types for per-artifact draft views."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# === Base class for common draft fields ===


class DraftViewItemBase(BaseModel):
    """Common fields shared by all per-artifact draft view items."""

    draft_id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    version: int = 0
    generated: bool = False
    mcp: bool = False
    active: bool = True
    group_id: UUID | None = None


# === Per-artifact draft view item types ===


class DraftAgentViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    model_ids: list[UUID] = Field(default_factory=list)
    prompt_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    temperature_level_ids: list[UUID] = Field(default_factory=list)
    reasoning_level_ids: list[UUID] = Field(default_factory=list)
    voice_ids: list[UUID] = Field(default_factory=list)


class DraftAuthViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    protocol_ids: list[UUID] = Field(default_factory=list)
    slug_ids: list[UUID] = Field(default_factory=list)


class DraftCohortViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    simulation_ids: list[UUID] = Field(default_factory=list)
    simulation_position_ids: list[UUID] = Field(default_factory=list)


class DraftDepartmentViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    settings_ids: list[UUID] = Field(default_factory=list)


class DraftDocumentViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    upload_ids: list[UUID] = Field(default_factory=list)
    image_ids: list[UUID] = Field(default_factory=list)
    text_ids: list[UUID] = Field(default_factory=list)


class DraftEvalViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)


class DraftFieldViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)


class DraftModelViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    value_ids: list[UUID] = Field(default_factory=list)
    provider_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    modality_ids: list[UUID] = Field(default_factory=list)
    temperature_level_ids: list[UUID] = Field(default_factory=list)
    pricing_ids: list[UUID] = Field(default_factory=list)
    reasoning_level_ids: list[UUID] = Field(default_factory=list)
    quality_ids: list[UUID] = Field(default_factory=list)
    voice_ids: list[UUID] = Field(default_factory=list)


class DraftParameterViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)


class DraftPersonaViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    color_ids: list[UUID] = Field(default_factory=list)
    icon_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    example_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)


class DraftProfileViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)


class DraftProviderViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    value_ids: list[UUID] = Field(default_factory=list)
    endpoint_ids: list[UUID] = Field(default_factory=list)
    key_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)


class DraftRubricViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    point_ids: list[UUID] = Field(default_factory=list)
    standard_group_ids: list[UUID] = Field(default_factory=list)
    standard_ids: list[UUID] = Field(default_factory=list)


class DraftScenarioViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    persona_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    question_ids: list[UUID] = Field(default_factory=list)


class DraftSettingViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    color_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)


class DraftSimulationViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    scenario_ids: list[UUID] = Field(default_factory=list)
    scenario_flag_ids: list[UUID] = Field(default_factory=list)
    scenario_position_ids: list[UUID] = Field(default_factory=list)
    scenario_rubric_ids: list[UUID] = Field(default_factory=list)
    scenario_time_limit_ids: list[UUID] = Field(default_factory=list)


class DraftTrainingViewItem(DraftViewItemBase):
    department_ids: list[UUID] = Field(default_factory=list)
    persona_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    field_ids: list[UUID] = Field(default_factory=list)
    question_ids: list[UUID] = Field(default_factory=list)
    option_ids: list[UUID] = Field(default_factory=list)
    video_ids: list[UUID] = Field(default_factory=list)
    image_ids: list[UUID] = Field(default_factory=list)
    problem_statement_ids: list[UUID] = Field(default_factory=list)
    objective_ids: list[UUID] = Field(default_factory=list)


class DraftToolViewItem(DraftViewItemBase):
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    args_ids: list[UUID] = Field(default_factory=list)
    args_outputs_ids: list[UUID] = Field(default_factory=list)


class DraftBenchmarkViewItem(DraftViewItemBase):
    department_ids: list[UUID] = Field(default_factory=list)
    model_ids: list[UUID] = Field(default_factory=list)
    prompt_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    voice_ids: list[UUID] = Field(default_factory=list)
    temperature_level_ids: list[UUID] = Field(default_factory=list)
    reasoning_level_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    key_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)

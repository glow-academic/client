"""Types for training bundle view."""

from uuid import UUID

from pydantic import BaseModel, Field


class GetTrainingBundleViewResponse(BaseModel):
    """Thin MV-backed view response for a single training bundle."""

    profile_has_access: bool = False
    training_bundle_entry_id: UUID | None = None
    training_id: UUID | None = None
    # Single scenario (from connection)
    scenario_id: UUID | None = None
    # Bundle-level resource ID arrays
    department_ids: list[UUID] = Field(default_factory=list)
    persona_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    question_ids: list[UUID] = Field(default_factory=list)
    option_ids: list[UUID] = Field(default_factory=list)
    video_ids: list[UUID] = Field(default_factory=list)
    image_ids: list[UUID] = Field(default_factory=list)
    problem_statement_ids: list[UUID] = Field(default_factory=list)
    objective_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    # 5 scenario flags
    video_enabled: bool = False
    problem_statement_enabled: bool = False
    objectives_enabled: bool = False
    images_enabled: bool = False
    questions_enabled: bool = False

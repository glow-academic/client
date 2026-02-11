"""Types for training bundle view."""

from uuid import UUID

from pydantic import BaseModel, Field


class GetTrainingBundleViewResponse(BaseModel):
    """Thin view response for a single training bundle."""

    profile_has_access: bool = False
    training_bundle_entry_id: UUID | None = None
    training_id: UUID | None = None
    simulation_id: UUID | None = None
    simulation_name: str | None = None
    scenario_id: UUID | None = None
    department_ids: list[UUID] = Field(default_factory=list)
    persona_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    scenario_time_limit_ids: list[UUID] = Field(default_factory=list)

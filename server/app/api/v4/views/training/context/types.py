"""Types for training context view."""

from uuid import UUID

from pydantic import BaseModel, Field


class TrainingContextViewItem(BaseModel):
    """IDs-first training simulation item — raw IDs only, no computed fields."""

    simulation_id: UUID
    training_bundle_entry_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None


class GetTrainingContextViewResponse(BaseModel):
    """View-layer response for training context."""

    actor_name: str | None = None
    user_role: str | None = None
    items: list[TrainingContextViewItem] = Field(default_factory=list)

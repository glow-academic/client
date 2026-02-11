"""Types for training context view."""

from uuid import UUID

from pydantic import BaseModel, Field


class TrainingContextViewItem(BaseModel):
    """IDs-first training simulation item."""

    simulation_id: UUID
    training_bundle_entry_id: UUID | None = None
    scenario_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    color: str | None = None
    icon: str | None = None
    attempt_count: int | None = None
    highest_score_percent: float | None = None
    has_passed: bool | None = None
    standard_group_ids: list[UUID] | None = None
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None


class GetTrainingContextViewResponse(BaseModel):
    """View-layer response for training context."""

    actor_name: str | None = None
    user_role: str | None = None
    items: list[TrainingContextViewItem] = Field(default_factory=list)
    standard_group_ids: list[UUID] = Field(default_factory=list)
    standard_ids: list[UUID] = Field(default_factory=list)

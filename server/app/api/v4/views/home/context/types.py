"""Types for home context view."""

from uuid import UUID

from pydantic import BaseModel, Field


class HomeContextViewItem(BaseModel):
    """IDs-first home simulation item — raw IDs only, no computed fields."""

    simulation_id: UUID
    chat_entry_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    time_limit_ids: list[UUID] | None = None


class GetHomeContextViewResponse(BaseModel):
    """View-layer response for home context."""

    actor_name: str | None = None
    user_role: str | None = None
    items: list[HomeContextViewItem] = Field(default_factory=list)

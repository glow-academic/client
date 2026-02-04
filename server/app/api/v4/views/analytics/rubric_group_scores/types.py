"""Types for analytics rubric group scores view."""

from uuid import UUID

from pydantic import BaseModel, Field


class RubricGroupScoreItem(BaseModel):
    """Per-chat rubric standard-group score row."""

    chat_id: UUID
    rubric_id: UUID
    standard_group_id: UUID
    group_name: str | None = None
    group_short_name: str | None = None
    score_percent: float | None = None


class GetRubricGroupScoresResponse(BaseModel):
    """Response model for rubric group scores query."""

    items: list[RubricGroupScoreItem] = Field(default_factory=list)

"""Types for practice artifact endpoint."""

from pydantic import BaseModel

from app.api.v4.artifacts.training.types import (
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
    TrainingSimulationOperational,
)


class GetPracticeResponse(BaseModel):
    """Client-facing API response for practice get (operational).

    Returns practice simulations user can take, scoped by their cohorts.
    """

    actor_name: str | None = None
    items: list[TrainingSimulationOperational] | None = None
    rubrics: list[RubricMapping] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None

"""Types for get_scenario_rubrics."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ScenarioRubricItem(BaseModel):
    id: UUID
    rubric_id: UUID
    scenario_id: UUID
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool

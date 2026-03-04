"""Types for get_model_rubrics."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ModelRubricItem(BaseModel):
    id: UUID
    model_id: UUID
    rubric_id: UUID
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool

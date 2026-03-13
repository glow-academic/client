"""Types for parameters resource."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetParameterResponse(BaseModel):
    id: UUID
    name: str
    description: str
    value: str
    department_ids: list[UUID]
    persona_parameter: bool
    document_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    field_ids: list[UUID]
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool

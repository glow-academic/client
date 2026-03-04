"""Types for fields resource."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetFieldResponse(BaseModel):
    id: UUID
    name: str
    description: str
    value: str
    department_ids: list[UUID]
    conditional_parameter_ids: list[UUID]
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool

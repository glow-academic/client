"""Types for get_conditional_parameters."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ConditionalParameterItem(BaseModel):
    id: UUID
    parameter_id: UUID
    created_at: datetime
    updated_at: datetime
    active: bool
    generated: bool
    mcp: bool

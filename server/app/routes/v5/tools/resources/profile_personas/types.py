"""Types for get_profile_personas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProfilePersonaItem(BaseModel):
    id: UUID
    profile_id: UUID
    persona_id: UUID
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool

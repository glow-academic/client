"""Types for get_simulation_availability."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SimulationAvailabilityItem(BaseModel):
    id: UUID
    simulation_id: UUID
    time: datetime
    type: str
    created_at: datetime
    updated_at: datetime
    active: bool
    generated: bool
    mcp: bool

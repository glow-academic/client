"""scenarios resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

from pydantic import BaseModel


# SQL path for creating denormalized scenarios_resource
class CreateScenariosSqlRow(BaseModel):
    """SQL row returned from creating a scenarios_resource."""

    scenarios_resource_id: UUID | None = None

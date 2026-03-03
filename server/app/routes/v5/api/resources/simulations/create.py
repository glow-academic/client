"""simulations resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

from pydantic import BaseModel


# SQL path for creating denormalized simulations_resource
class CreateSimulationsSqlRow(BaseModel):
    """SQL row returned from creating a simulations_resource."""

    simulations_resource_id: UUID | None = None

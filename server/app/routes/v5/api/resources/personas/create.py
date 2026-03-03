"""personas resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

from pydantic import BaseModel


# SQL path for creating denormalized personas_resource
class CreatePersonasSqlRow(BaseModel):
    """SQL row returned from creating a personas_resource."""

    personas_resource_id: UUID | None = None

"""cohorts resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

from pydantic import BaseModel


# SQL path for creating denormalized cohorts_resource
class CreateCohortsSqlRow(BaseModel):
    """SQL row returned from creating a cohorts_resource."""

    cohorts_resource_id: UUID | None = None

"""cohorts resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL path for creating denormalized cohorts_resource
SQL_PATH = "app/sql/queries/resources/cohorts/create_cohorts_complete.sql"


class CreateCohortsSqlParams(BaseModel):
    """SQL parameters for creating a denormalized cohorts_resource."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    profile_persona_ids: list[UUID] | None = None
    simulation_position_ids: list[UUID] | None = None
    simulation_availability_ids: list[UUID] | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.name_id,
            self.description_id,
            self.department_ids or [],
            self.simulation_ids or [],
            self.profile_ids or [],
            self.profile_persona_ids or [],
            self.simulation_position_ids or [],
            self.simulation_availability_ids or [],
            self.mcp,
        )


class CreateCohortsSqlRow(BaseModel):
    """SQL row returned from creating a cohorts_resource."""

    cohorts_resource_id: UUID | None = None


async def create_cohorts_internal(
    conn: asyncpg.Connection,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    profile_ids: list[UUID] | None = None,
    profile_persona_ids: list[UUID] | None = None,
    simulation_position_ids: list[UUID] | None = None,
    simulation_availability_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> UUID:
    """Create a denormalized cohorts_resource and return its ID.

    Looks up actual values from the referenced resource tables
    (names_resource.name, descriptions_resource.description) and
    stores a flattened snapshot in cohorts_resource.
    """
    params = CreateCohortsSqlParams(
        name_id=name_id,
        description_id=description_id,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        profile_ids=profile_ids,
        profile_persona_ids=profile_persona_ids,
        simulation_position_ids=simulation_position_ids,
        simulation_availability_ids=simulation_availability_ids,
        mcp=mcp,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    if not result or not result.cohorts_resource_id:
        raise ValueError("Failed to create cohorts resource")

    await invalidate_tags(["resources", "cohorts"])
    return result.cohorts_resource_id

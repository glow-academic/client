"""simulations resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL path for creating denormalized simulations_resource
SQL_PATH = "app/sql/v4/queries/resources/simulations/create_simulations_complete.sql"


class CreateSimulationsSqlParams(BaseModel):
    """SQL parameters for creating a denormalized simulations_resource."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.name_id,
            self.description_id,
            self.department_ids or [],
            self.scenario_ids or [],
            self.mcp,
        )


class CreateSimulationsSqlRow(BaseModel):
    """SQL row returned from creating a simulations_resource."""

    simulations_resource_id: UUID | None = None


async def create_simulations_internal(
    conn: asyncpg.Connection,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    scenario_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> UUID:
    """Create a denormalized simulations_resource and return its ID.

    Looks up actual values from the referenced resource tables
    (names_resource.name, descriptions_resource.description) and
    stores a flattened snapshot in simulations_resource.
    """
    params = CreateSimulationsSqlParams(
        name_id=name_id,
        description_id=description_id,
        department_ids=department_ids,
        scenario_ids=scenario_ids,
        mcp=mcp,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    if not result or not result.simulations_resource_id:
        raise ValueError("Failed to create simulations resource")

    await invalidate_tags(["resources", "simulations"])
    return result.simulations_resource_id

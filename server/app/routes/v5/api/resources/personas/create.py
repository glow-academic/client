"""personas resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL path for creating denormalized personas_resource
SQL_PATH = "app/sql/queries/resources/personas/create_personas_complete.sql"


class CreatePersonasSqlParams(BaseModel):
    """SQL parameters for creating a denormalized personas_resource."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    color_id: UUID | None = None
    icon_id: UUID | None = None
    instructions_id: UUID | None = None
    department_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.name_id,
            self.description_id,
            self.color_id,
            self.icon_id,
            self.instructions_id,
            self.department_ids or [],
            self.example_ids or [],
            self.parameter_field_ids or [],
            self.mcp,
        )


class CreatePersonasSqlRow(BaseModel):
    """SQL row returned from creating a personas_resource."""

    personas_resource_id: UUID | None = None


async def create_personas_internal(
    conn: asyncpg.Connection,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    color_id: UUID | None = None,
    icon_id: UUID | None = None,
    instructions_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    example_ids: list[UUID] | None = None,
    parameter_field_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> UUID:
    """Create a denormalized personas_resource and return its ID.

    Looks up actual values from the referenced resource tables
    (names_resource.name, colors_resource.hex_code, etc.) and
    stores a flattened snapshot in personas_resource.
    """
    params = CreatePersonasSqlParams(
        name_id=name_id,
        description_id=description_id,
        color_id=color_id,
        icon_id=icon_id,
        instructions_id=instructions_id,
        department_ids=department_ids,
        example_ids=example_ids,
        parameter_field_ids=parameter_field_ids,
        mcp=mcp,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    if not result or not result.personas_resource_id:
        raise ValueError("Failed to create personas resource")

    await invalidate_tags(["resources", "personas"])
    return result.personas_resource_id

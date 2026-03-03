"""Tools layer: Persona save — pure data access, no permissions or caching."""

from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.personas.create import create_personas_internal
from app.sql.types import (
    ToolsSavePersonaSqlParams,
    ToolsSavePersonaSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_save_persona_complete.sql"


async def save_persona_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    group_id: UUID | None,
    resource_actions: dict[str, Any],
    persona_id: UUID | None = None,
    soft: bool = False,
) -> UUID | None:
    """Save (create or update) a persona with resource junctions.

    Pure data access — no transaction management, no cache invalidation, no pool.
    The caller owns the transaction boundary and cache invalidation.

    Args:
        conn: Database connection (caller manages transaction).
        profile_id: Acting user's profile ID.
        group_id: Tool tracking group (unused internally, kept for signature compat).
        resource_actions: Dict of resource_type -> {resource_id, resource_ids} dicts.
        persona_id: Existing persona ID for update, None for create.
        soft: If True, creates persona with active=false (dormant).

    Returns the persona_id on success, None on failure.
    """

    def _id(key: str) -> UUID | None:
        val = resource_actions.get(key, {})
        if isinstance(val, dict):
            return val.get("resource_id")
        return None

    def _ids(key: str) -> list[UUID] | None:
        val = resource_actions.get(key, {})
        if isinstance(val, dict):
            return val.get("resource_ids")
        return None

    name_id = _id("names")
    description_id = _id("descriptions")
    color_id = _id("colors")
    icon_id = _id("icons")
    instructions_id = _id("instructions")
    active_flag_id = _id("flags")
    department_ids = _ids("departments")
    parameter_field_ids = _ids("parameter_fields")
    example_ids = _ids("examples")
    voice_ids = _ids("voices")

    # Create denormalized personas_resource
    personas_resource_id = await create_personas_internal(
        conn,
        name_id=name_id,
        description_id=description_id,
        color_id=color_id,
        icon_id=icon_id,
        instructions_id=instructions_id,
        department_ids=department_ids,
        example_ids=example_ids,
        parameter_field_ids=parameter_field_ids,
    )

    active_value = not soft

    params = ToolsSavePersonaSqlParams(
        profile_id=profile_id,
        input_persona_id=persona_id,
        name_id=name_id,
        description_id=description_id,
        color_id=color_id,
        icon_id=icon_id,
        instructions_id=instructions_id,
        active_flag_id=active_flag_id,
        department_ids=department_ids,
        parameter_field_ids=parameter_field_ids,
        example_ids=example_ids,
        voice_ids=voice_ids,
        personas_resource_id=personas_resource_id,
        active_value=active_value,
    )

    result = cast(
        ToolsSavePersonaSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.persona_id:
        return None

    return result.persona_id

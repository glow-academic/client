"""Tools layer: Persona draft patch — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    PersonaMultiResourceAction,
    PersonaResourceAction,
    ToolsPatchPersonaDraftSqlParams,
    ToolsPatchPersonaDraftSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_patch_persona_draft_complete.sql"


async def patch_persona_draft_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    *,
    input_draft_id: UUID | None = None,
    expected_version: int = 0,
    group_id: UUID | None = None,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    color_id: UUID | None = None,
    icon_id: UUID | None = None,
    instructions_id: UUID | None = None,
    active_flag_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    parameter_field_ids: list[UUID] | None = None,
    example_ids: list[UUID] | None = None,
    parameter_ids: list[UUID] | None = None,
    voice_ids: list[UUID] | None = None,
    soft: bool = False,
) -> ToolsPatchPersonaDraftSqlRow:
    """Create or update a persona draft with resource junctions.

    Pure data access — no transaction management, no cache invalidation, no pool.
    The caller owns the transaction boundary and cache invalidation.

    Accepts flat resource IDs and builds composite params for the SQL function.

    Args:
        conn: Database connection (caller owns transaction).
        profile_id: The profile performing the action.
        input_draft_id: Existing draft ID for update, None for create.
        expected_version: Optimistic concurrency version.
        group_id: Optional group_id for tool tracking.
        name_id: Name resource ID.
        description_id: Description resource ID.
        color_id: Color resource ID.
        icon_id: Icon resource ID.
        instructions_id: Instructions resource ID.
        active_flag_id: Active flag resource ID.
        department_ids: Department resource IDs.
        parameter_field_ids: Parameter field resource IDs.
        example_ids: Example resource IDs.
        parameter_ids: Parameter resource IDs.
        voice_ids: Voice resource IDs.
        soft: If True, creates dormant draft (active=false).

    Returns:
        ToolsPatchPersonaDraftSqlRow with draft_id, new_version, draft_exists.
    """
    active_value = not soft
    params = ToolsPatchPersonaDraftSqlParams(
        profile_id=profile_id,
        input_draft_id=input_draft_id,
        group_id=group_id,
        names=PersonaResourceAction(
            resource_id=name_id, create_tool_id=None, link_tool_id=None
        ),
        descriptions=PersonaResourceAction(
            resource_id=description_id, create_tool_id=None, link_tool_id=None
        ),
        colors=PersonaResourceAction(
            resource_id=color_id, create_tool_id=None, link_tool_id=None
        ),
        icons=PersonaResourceAction(
            resource_id=icon_id, create_tool_id=None, link_tool_id=None
        ),
        instructions=PersonaResourceAction(
            resource_id=instructions_id, create_tool_id=None, link_tool_id=None
        ),
        flags=PersonaResourceAction(
            resource_id=active_flag_id, create_tool_id=None, link_tool_id=None
        ),
        departments=PersonaMultiResourceAction(
            resource_ids=department_ids, create_tool_id=None, link_tool_id=None
        ),
        parameter_fields=PersonaMultiResourceAction(
            resource_ids=parameter_field_ids, create_tool_id=None, link_tool_id=None
        ),
        examples=PersonaMultiResourceAction(
            resource_ids=example_ids, create_tool_id=None, link_tool_id=None
        ),
        parameters=PersonaMultiResourceAction(
            resource_ids=parameter_ids, create_tool_id=None, link_tool_id=None
        ),
        voices=PersonaMultiResourceAction(
            resource_ids=voice_ids, create_tool_id=None, link_tool_id=None
        ),
        expected_version=expected_version,
        active_value=active_value,
    )

    result = cast(
        ToolsPatchPersonaDraftSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result:
        raise ValueError("Failed to patch persona draft")

    return result

"""Artifact tool call handler - executes tools and returns tool_result for token factory."""

import json
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.artifacts.discovery import map_template_values_to_table_columns
from app.infra.v4.tools.render_tool_template import render_tool_template
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.sql.types import (
    InfraToolsCreateCallForToolSqlParams,
    InfraToolsCreateCallForToolSqlRow,
    InfraToolsGetResourceTypeByToolIdSqlParams,
    InfraToolsGetResourceTypeByToolIdSqlRow,
    InfraToolsGetToolIdByNameSqlParams,
    InfraToolsGetToolIdByNameSqlRow,
    InfraToolsIsToolCreatableSqlParams,
    InfraToolsIsToolCreatableSqlRow,
    InfraToolsLinkToolCallSqlParams,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("tool_call")  # type: ignore
async def artifact_tool_call_internal(data: dict[str, Any]) -> None:
    """Handle tool_call events for artifact domains."""
    artifact_type = data.get("artifact_type")
    if artifact_type not in {
        "attempt",
        "persona",
        "agent",
        "scenario",
        "cohort",
        "profile",
        "simulation",
        "rubric",
        "document",
        "eval",
    }:
        return

    call_id = data.get("call_id") or data.get("tool_call_id")
    tool_name = data.get("tool_name")
    arguments = data.get("arguments") or {}
    run_id = data.get("run_id")

    if not call_id or not tool_name or not run_id:
        return

    async with get_db_connection() as conn:
        # Get tool_id by name
        tool_params = InfraToolsGetToolIdByNameSqlParams(tool_name=tool_name)
        tool_result = cast(
            InfraToolsGetToolIdByNameSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/infrastructure/tools/get_tool_id_by_name_complete.sql",
                params=tool_params,
            ),
        )
        if not tool_result or not tool_result.tool_id:
            await internal_sio.emit(
                "tool_result",
                {
                    "call_id": call_id,
                    "success": False,
                    "error": f"Tool not found: {tool_name}",
                },
            )
            return

        tool_id = tool_result.tool_id

        # Check if tool is creatable (INSERT) or link-only (SELECT existing)
        creatable_params = InfraToolsIsToolCreatableSqlParams(p_tool_id=tool_id)
        creatable_result = cast(
            InfraToolsIsToolCreatableSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/infrastructure/tools/is_tool_creatable_complete.sql",
                params=creatable_params,
            ),
        )
        is_creatable = creatable_result.is_creatable if creatable_result else True

        # Get resource_type by tool_id
        resource_params = InfraToolsGetResourceTypeByToolIdSqlParams(tool_id=tool_id)
        resource_result = cast(
            InfraToolsGetResourceTypeByToolIdSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/infrastructure/tools/get_resource_type_by_tool_id_complete.sql",
                params=resource_params,
            ),
        )
        if not resource_result or not resource_result.resource_type:
            await internal_sio.emit(
                "tool_result",
                {
                    "call_id": call_id,
                    "success": False,
                    "error": f"No resource_type for tool: {tool_name}",
                },
            )
            return

        resource_type = resource_result.resource_type

        # Create call entry
        call_params = InfraToolsCreateCallForToolSqlParams(
            external_call_id=str(call_id),
            run_id=uuid.UUID(run_id),
            arguments_raw=json.dumps(arguments),
        )
        call_result = cast(
            InfraToolsCreateCallForToolSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/infrastructure/tools/create_call_for_tool_complete.sql",
                params=call_params,
            ),
        )
        if not call_result or not call_result.call_id:
            await internal_sio.emit(
                "tool_result",
                {
                    "call_id": call_id,
                    "success": False,
                    "error": "Failed to create tool call",
                },
            )
            return

        call_db_id = call_result.call_id

        # Link tool to call
        link_params = InfraToolsLinkToolCallSqlParams(
            tool_id=tool_id,
            call_id=call_db_id,
        )
        await execute_sql_typed(
            conn,
            "app/sql/v4/queries/infrastructure/tools/link_tool_call_complete.sql",
            params=link_params,
        )

        rendered_values = await render_tool_template(conn, tool_id, arguments)
        mapped_values = await map_template_values_to_table_columns(
            conn, resource_type, rendered_values, tool_id=str(tool_id)
        )

        resource_id = None

        if is_creatable:
            # CREATE tool: INSERT new record
            create_resource_sql = load_sql(
                "app/sql/v4/queries/resources/create_resource_record_complete.sql"
            )
            resource_row = await conn.fetchrow(
                create_resource_sql,
                resource_type,
                call_db_id,
                False,
                json.dumps(mapped_values),
            )
            already_exists = False
            if resource_row and resource_row.get("id"):
                resource_id = str(resource_row["id"])
                already_exists = resource_row.get("already_exists", False)
        else:
            # LINK tool: SELECT existing record by ID
            # mapped_values should contain {"id": "<existing_resource_id>"}
            existing_id = mapped_values.get("id")
            if not existing_id:
                await internal_sio.emit(
                    "tool_result",
                    {
                        "call_id": call_id,
                        "success": False,
                        "error": f"Link tool {tool_name} requires an id in arguments",
                    },
                )
                return

            # Validate the resource exists
            table_name = f"{resource_type}_resource"
            check_sql = f"SELECT id FROM {table_name} WHERE id = $1"
            existing_row = await conn.fetchrow(check_sql, uuid.UUID(existing_id))
            if not existing_row:
                await internal_sio.emit(
                    "tool_result",
                    {
                        "call_id": call_id,
                        "success": False,
                        "error": f"Resource not found: {resource_type} with id {existing_id}",
                    },
                )
                return

            # Link the call to the existing resource via junction table
            junction_table = f"call_{resource_type}_junction"
            resource_col = f"{resource_type}_id"
            link_sql = f"""
                INSERT INTO {junction_table} (call_id, {resource_col})
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            """
            await conn.execute(link_sql, call_db_id, uuid.UUID(existing_id))
            resource_id = existing_id
            already_exists = False  # LINK tools don't have this concept

        await internal_sio.emit(
            "tool_result",
            {
                "call_id": call_id,
                "success": True,
                "tool_name": tool_name,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "call_db_id": str(call_db_id),
                "already_exists": already_exists,
            },
        )

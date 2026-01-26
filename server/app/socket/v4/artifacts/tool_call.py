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
    InfraToolsGetTemplateIdV4SqlParams,
    InfraToolsGetTemplateIdV4SqlRow,
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
        tool_id_sql = load_sql(
            "app/sql/v4/queries/infrastructure/tools/get_tool_id_by_name_complete.sql"
        )
        tool_row = await conn.fetchrow(tool_id_sql, tool_name)
        if not tool_row or not tool_row.get("tool_id"):
            await internal_sio.emit(
                "tool_result",
                {
                    "call_id": call_id,
                    "success": False,
                    "error": f"Tool not found: {tool_name}",
                },
            )
            return

        tool_id = uuid.UUID(str(tool_row["tool_id"]))

        resource_type_sql = load_sql(
            "app/sql/v4/queries/infrastructure/tools/get_resource_type_by_tool_id_complete.sql"
        )
        resource_row = await conn.fetchrow(resource_type_sql, tool_id)
        if not resource_row or not resource_row.get("resource_type"):
            await internal_sio.emit(
                "tool_result",
                {
                    "call_id": call_id,
                    "success": False,
                    "error": f"No resource_type for tool: {tool_name}",
                },
            )
            return

        resource_type = str(resource_row["resource_type"])

        template_params = InfraToolsGetTemplateIdV4SqlParams(tool_id=tool_id)
        template_result = cast(
            InfraToolsGetTemplateIdV4SqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/infrastructure/tools/get_template_id_v4_complete.sql",
                params=template_params,
            ),
        )
        template_id = template_result.template_id if template_result else None

        create_call_sql = load_sql(
            "app/sql/v4/queries/infrastructure/tools/create_call_for_tool_complete.sql"
        )
        call_row = await conn.fetchrow(
            create_call_sql,
            str(call_id),
            uuid.UUID(run_id),
            template_id,
            json.dumps(arguments),
        )
        if not call_row or not call_row.get("call_id"):
            await internal_sio.emit(
                "tool_result",
                {
                    "call_id": call_id,
                    "success": False,
                    "error": "Failed to create tool call",
                },
            )
            return

        call_db_id = uuid.UUID(str(call_row["call_id"]))

        link_sql = load_sql(
            "app/sql/v4/queries/infrastructure/tools/link_tool_call_complete.sql"
        )
        await conn.execute(link_sql, tool_id, call_db_id)

        rendered_values = await render_tool_template(conn, tool_id, arguments)
        mapped_values = await map_template_values_to_table_columns(
            conn, resource_type, rendered_values, tool_id=str(tool_id)
        )

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

        resource_id = None
        if resource_row and resource_row.get("id"):
            resource_id = str(resource_row["id"])

        await internal_sio.emit(
            "tool_result",
            {
                "call_id": call_id,
                "success": True,
                "tool_name": tool_name,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "call_db_id": str(call_db_id),
            },
        )

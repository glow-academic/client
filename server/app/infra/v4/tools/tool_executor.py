"""Tool executor - executes tool calls and returns results for model consumption.

This module provides the function body for tool execution. Results are returned
as JSON strings that can be appended to messages for the model to see.

This enables the agentic loop pattern where:
1. Model makes tool calls
2. Tool executes and returns result (including errors)
3. Result is appended as role="tool" message
4. Model sees result and can retry if needed
"""

import json
import uuid
from typing import Any

import asyncpg

from app.infra.v4.artifacts.discovery import map_template_values_to_table_columns
from app.infra.v4.tools.render_tool_template import render_tool_template
from app.sql.types import (
    InfraToolsGetEntryTypeByToolIdSqlParams,
    InfraToolsGetResourceTypeByToolIdSqlParams,
    InfraToolsGetResourceTypeByToolIdSqlRow,
    InfraToolsGetToolIdByNameSqlParams,
    InfraToolsGetToolIdByNameSqlRow,
    InfraToolsIsToolCreatableSqlParams,
    InfraToolsIsToolCreatableSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)


async def execute_tool_call(
    conn: asyncpg.Connection,
    tool_name: str,
    arguments: dict[str, Any],
    run_id: uuid.UUID | None = None,
) -> str:
    """Execute a tool call and return result as JSON string for model.

    This is the "function body" that gets executed when the model calls a tool.
    The return value becomes the content of the role="tool" message that the
    model sees, enabling retries on errors.

    Args:
        conn: Database connection
        tool_name: Name of the tool (e.g., "create_names", "use_names")
        arguments: Tool arguments from the model
        run_id: Optional run ID for linking calls

    Returns:
        JSON string with result:
        - Success: {"success": true, "message": "Successfully created names entry with id: uuid"}
        - Error: {"success": false, "message": "Error description"}
    """
    try:
        # Get tool_id by name
        tool_params = InfraToolsGetToolIdByNameSqlParams(tool_name=tool_name)
        tool_result = await execute_sql_typed(
            conn,
            "app/sql/v4/queries/infrastructure/tools/get_tool_id_by_name_complete.sql",
            params=tool_params,
        )

        if not tool_result or not getattr(tool_result, "tool_id", None):
            return json.dumps({
                "success": False,
                "message": f"Tool not found: {tool_name}",
            })

        tool_id = tool_result.tool_id

        # First, check if this is an entry-based tool (has binding with entry type)
        entry_params = InfraToolsGetEntryTypeByToolIdSqlParams(tool_id=tool_id)
        entry_result = await execute_sql_typed(
            conn,
            "app/sql/v4/queries/infrastructure/tools/get_entry_type_by_tool_id_complete.sql",
            params=entry_params,
        )

        if entry_result and getattr(entry_result, "entry_type", None):
            # Entry-based tool: insert into {entry}_entry table
            return await _execute_entry_tool(
                conn, tool_id, tool_name, entry_result.entry_type, arguments, run_id
            )

        # Otherwise, fall back to resource-based tool logic
        return await _execute_resource_tool(conn, tool_id, tool_name, arguments, run_id)

    except Exception as e:
        logger.exception(f"Error executing tool {tool_name}: {e}")
        return json.dumps({
            "success": False,
            "message": f"Tool execution error: {str(e)}",
        })


async def _execute_entry_tool(
    conn: asyncpg.Connection,
    tool_id: uuid.UUID,
    tool_name: str,
    entry_type: str,
    arguments: dict[str, Any],
    run_id: uuid.UUID | None = None,
) -> str:
    """Execute an entry-based tool (inserts into {entry}_entry table).

    Entry-based tools create records in entry tables (e.g., contents_entry, hints_entry)
    rather than resource tables.

    Args:
        conn: Database connection
        tool_id: The tool's UUID
        tool_name: Name of the tool
        entry_type: The entry type (e.g., "contents", "hints")
        arguments: Tool arguments from the model
        run_id: Optional run ID for linking calls

    Returns:
        JSON string with result
    """
    try:
        # Render tool templates (maps arguments to output columns)
        rendered_values = await render_tool_template(conn, tool_id, arguments)
        mapped_values = await map_template_values_to_table_columns(
            conn, entry_type, rendered_values, tool_id=str(tool_id), is_entry=True
        )

        if not mapped_values:
            return json.dumps({
                "success": False,
                "message": f"No values to insert for {tool_name}. Check tool configuration.",
            })

        create_entry_sql = load_sql(
            "app/sql/v4/queries/entries/create_entry_record_complete.sql"
        )

        # Insert into {entry}_entry table
        entry_row = await conn.fetchrow(
            create_entry_sql,
            entry_type,
            None,  # call_id - not used in agentic flow
            False,  # mcp
            json.dumps(mapped_values),
        )

        if entry_row and entry_row.get("id"):
            entry_id = str(entry_row["id"])
            already_exists = entry_row.get("already_exists", False)
            if already_exists:
                return json.dumps({
                    "success": True,
                    "message": f"Entry already exists, using existing {entry_type} entry",
                    "entry_id": entry_id,
                })
            return json.dumps({
                "success": True,
                "message": f"Successfully created {entry_type} entry",
                "entry_id": entry_id,
            })
        else:
            return json.dumps({
                "success": False,
                "message": f"Failed to create {entry_type} entry",
            })

    except Exception as e:
        logger.exception(f"Error executing entry tool {tool_name}: {e}")
        return json.dumps({
            "success": False,
            "message": f"Entry tool execution error: {str(e)}",
        })


async def _execute_resource_tool(
    conn: asyncpg.Connection,
    tool_id: uuid.UUID,
    tool_name: str,
    arguments: dict[str, Any],
    run_id: uuid.UUID | None = None,
) -> str:
    """Execute a resource-based tool (inserts into {resource}_resource table).

    Resource-based tools create or use records in resource tables.

    Args:
        conn: Database connection
        tool_id: The tool's UUID
        tool_name: Name of the tool
        arguments: Tool arguments from the model
        run_id: Optional run ID for linking calls

    Returns:
        JSON string with result
    """
    try:
        # Check if tool is creatable (INSERT) or use-only (SELECT existing)
        creatable_params = InfraToolsIsToolCreatableSqlParams(p_tool_id=tool_id)
        creatable_result = await execute_sql_typed(
            conn,
            "app/sql/v4/queries/infrastructure/tools/is_tool_creatable_complete.sql",
            params=creatable_params,
        )
        is_creatable = creatable_result.is_creatable if creatable_result else True

        # Get resource_type by tool_id
        resource_params = InfraToolsGetResourceTypeByToolIdSqlParams(tool_id=tool_id)
        resource_result = await execute_sql_typed(
            conn,
            "app/sql/v4/queries/infrastructure/tools/get_resource_type_by_tool_id_complete.sql",
            params=resource_params,
        )

        if not resource_result or not getattr(resource_result, "resource_type", None):
            return json.dumps({
                "success": False,
                "message": f"No resource_type configured for tool: {tool_name}",
            })

        resource_type = resource_result.resource_type

        # Render tool templates (maps arguments to output columns)
        rendered_values = await render_tool_template(conn, tool_id, arguments)
        mapped_values = await map_template_values_to_table_columns(
            conn, resource_type, rendered_values, tool_id=str(tool_id)
        )

        resource_id: str | None = None

        if is_creatable:
            # CREATE tool: INSERT new record
            if not mapped_values:
                return json.dumps({
                    "success": False,
                    "message": f"No values to insert for {tool_name}. Check tool configuration.",
                })

            create_resource_sql = load_sql(
                "app/sql/v4/queries/resources/create_resource_record_complete.sql"
            )

            # Note: We pass None for call_id since we're not tracking calls in this flow
            # The agentic loop handles the conversation history instead
            resource_row = await conn.fetchrow(
                create_resource_sql,
                resource_type,
                None,  # call_id - not used in agentic flow
                False,  # mcp
                json.dumps(mapped_values),
            )

            if resource_row and resource_row.get("id"):
                resource_id = str(resource_row["id"])
                already_exists = resource_row.get("already_exists", False)
                if already_exists:
                    # Resource already existed, return it as a "use" action
                    return json.dumps({
                        "success": True,
                        "message": f"Resource already exists, using existing {resource_type} entry",
                        "resource_id": resource_id,
                    })
            else:
                return json.dumps({
                    "success": False,
                    "message": f"Failed to create {resource_type} resource",
                })

        else:
            # USE tool: SELECT existing record by ID
            existing_id = mapped_values.get("id")
            if not existing_id:
                return json.dumps({
                    "success": False,
                    "message": f"Use tool {tool_name} requires an id argument. Please provide a valid {resource_type} id.",
                })

            # Validate the resource exists
            table_name = f"{resource_type}_resource"
            try:
                check_sql = f"SELECT id FROM {table_name} WHERE id = $1"
                existing_row = await conn.fetchrow(check_sql, uuid.UUID(existing_id))
            except ValueError:
                return json.dumps({
                    "success": False,
                    "message": f"Invalid id format: {existing_id}. Expected a valid UUID.",
                })

            if not existing_row:
                return json.dumps({
                    "success": False,
                    "message": f"Resource not found: {resource_type} with id {existing_id}. Please check the available resources and try again.",
                })

            resource_id = existing_id

        # Success!
        action = "created" if is_creatable else "used"
        return json.dumps({
            "success": True,
            "message": f"Successfully {action} {resource_type} entry",
            "resource_id": resource_id,
        })

    except Exception as e:
        logger.exception(f"Error executing resource tool {tool_name}: {e}")
        return json.dumps({
            "success": False,
            "message": f"Resource tool execution error: {str(e)}",
        })

"""Artifact completion handler - listens to internal completion events and routes by modality."""

import json
import uuid
from typing import Any, cast

import asyncpg
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.tools.render_tool_template import render_tool_template
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.sql.types import (CompleteImageGenerationSqlParams,
                           CompleteImageGenerationSqlRow,
                           CreateGenerationAndLinkSqlParams,
                           CreateGenerationAndLinkSqlRow, LogRunSqlParams,
                           LogRunSqlRow)
from fastapi import APIRouter
from utils.logging.db_logger import get_logger
from utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_IMAGE_COMPLETE = "app/sql/v4/images/complete_image_generation_complete.sql"
SQL_PATH_VIDEO_COMPLETE = "app/sql/v4/videos/create_generation_and_link_complete.sql"
SQL_PATH_LOG_RUN = "app/sql/v4/model_runs/log_run_complete.sql"

# Mapping from resource_type to SQL function name for tool execution
RESOURCE_SQL_FUNCTION_MAP = {
    "personas": "api_create_personas_v4",
    "names": "api_create_names_v4",
    "descriptions": "api_create_descriptions_v4",
    "colors": "api_create_colors_v4",
    "icons": "api_create_icons_v4",
    "instructions": "api_create_instructions_v4",
    "flags": "api_create_flags_v4",
    "examples": "api_create_examples_v4",
    "fields": "api_create_fields_v4",
    "departments": "api_create_departments_v4",
}

# Mapping from agent_role to agent end event name
AGENT_END_MAPPING = {
    "scenario": "scenario_end",
    "document": "document_end",
    "simulation": "simulation_end",
    "grade": "grade_end",
    "hint": "hint_end",
    "classify": "classify_end",
    "member": "member_end",
    "prompt": "prompt_end",
    "rubric": "rubric_end",
    "title": "title_end",
    "audio": "audio_end",
    "image": "image_end",
    "video": "video_end",
    "voice": "voice_end",
}


@internal_sio.on("generate_complete")  # type: ignore
async def handle_artifact_complete(data: dict[str, Any]) -> None:
    """Route completion events by output modality and handle SQL operations."""
    # Extract modality from payload
    modality = data.get("modality", "text")

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    completion_type = data.get("type", "run_complete")

    # Handle tool_call_complete template rendering and tool execution if applicable
    rendered_values: dict[str, Any] | None = None
    if completion_type == "tool_call_complete":
        call_id = data.get("call_id")
        tool_name = data.get("tool_name")
        resource_type = data.get("resource_type")
        group_id = data.get("group_id")
        agent_id = data.get("agent_id")

        if call_id:
            # Render templates (fixed function)
            rendered_values = await _handle_tool_call_template_rendering(call_id)

            # Execute tool to create resource record
            if tool_name and resource_type and agent_id:
                try:
                    async with get_db_connection() as conn:
                        resource_id = await _execute_tool_call(
                            conn=conn,
                            call_id=call_id,
                            tool_name=tool_name,
                            resource_type=resource_type,
                            group_id=uuid.UUID(group_id) if group_id else None,
                            agent_id=uuid.UUID(agent_id),
                        )
                        if resource_id:
                            logger.info(
                                f"Created {resource_type} resource {resource_id} from tool call {call_id}"
                            )
                except Exception as exec_error:
                    logger.warning(
                        f"Failed to execute tool call {call_id} for {resource_type}: {str(exec_error)}"
                    )

    # Handle SQL operations based on modality
    if completion_type == "run_complete":
        if modality == "image":
            await _handle_image_complete(data)
        elif modality == "video":
            await _handle_video_complete(data)
        elif modality in ("text", "call", "document"):
            await _handle_text_complete(data, sid)

    # Dispatch to agent-specific end handlers
    resource_type = data.get("resource_type", "text")
    # Map modality to resource_type for end handler
    modality_to_resource_type = {
        "text": resource_type,
        "call": resource_type,
        "document": resource_type,
        "image": "image",
        "video": "video",
        "audio": "voice",  # Audio maps to voice resource type
    }
    final_resource_type = modality_to_resource_type.get(modality, resource_type)

    agent_end_event = AGENT_END_MAPPING.get(final_resource_type, "text_end")

    # Build payload for agent-specific end handler
    emit_payload: dict[str, Any] = {
        "sid": sid,
        "type": completion_type,
        "resource_id": data.get("resource_id"),
        "run_id": data.get("run_id"),
        "group_id": data.get("group_id"),
        "department_id": data.get("department_id"),
        "tool_call_id": data.get("tool_call_id"),
        "call_id": data.get("call_id"),
        "tool_name": data.get("tool_name"),
        "tool_type": data.get("tool_type"),
        "final_content": data.get("final_content"),
        "arguments_raw": data.get("arguments_raw"),
    }

    # Include rendered template values if available
    if rendered_values is not None:
        emit_payload["rendered_template_values"] = rendered_values

    # Dispatch to agent-specific end handler
    await internal_sio.emit(agent_end_event, emit_payload)

    # Transform internal event format to client format
    client_payload = _build_client_payload(modality, completion_type, data)

    # Emit unified client event
    await sio.emit(
        "artifact_generation_complete",
        client_payload,
        room=sid,
    )


def _build_client_payload(
    modality: str, completion_type: str, data: dict[str, Any]
) -> dict[str, Any]:
    """Build client payload based on modality."""
    client_payload: dict[str, Any] = {
        "modality": modality,
        "resource_type": data.get("resource_type"),
        "resource_id": data.get("resource_id"),
        "run_id": data.get("run_id"),
        "group_id": data.get("group_id"),
        "type": completion_type,
    }

    # Add modality-specific fields
    if modality == "text" or modality == "call" or modality == "document":
        client_payload.update(
            {
                "input_text_tokens": data.get("input_text_tokens"),
                "output_text_tokens": data.get("output_text_tokens"),
                "system_prompt": data.get("system_prompt"),
                "assistant_output": data.get("assistant_output"),
            }
        )
    elif modality == "image":
        client_payload.update(
            {
                "image_id": data.get("image_id"),
                "file_path": data.get("file_path"),
                "mime_type": data.get("mime_type"),
                "file_size": data.get("file_size"),
            }
        )
    elif modality == "video":
        client_payload.update(
            {
                "success": data.get("success", True),
                "message": data.get("message"),
                "videoUrl": data.get("videoUrl"),
                "video_id": data.get("video_id"),
            }
        )
    elif modality == "audio":
        client_payload.update(
            {
                "model": data.get("model"),
            }
        )

    return client_payload


async def _handle_image_complete(data: dict[str, Any]) -> None:
    """Handle image completion SQL operation."""
    try:
        image_id_str = data.get("image_id")
        file_path = data.get("file_path")
        mime_type = data.get("mime_type")
        file_size = data.get("file_size")

        if not image_id_str or not file_path or not mime_type or file_size is None:
            return

        image_id = uuid.UUID(image_id_str)

        async with get_db_connection() as conn:
            params = CompleteImageGenerationSqlParams(
                image_id=image_id,
                file_path=file_path,
                mime_type=mime_type,
                file_size=file_size,
            )
            await execute_sql_typed(conn, SQL_PATH_IMAGE_COMPLETE, params=params)
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Failed to complete image generation")


async def _handle_video_complete(data: dict[str, Any]) -> None:
    """Handle video completion SQL operation."""
    try:
        video_id_str = data.get("video_id")
        file_path = data.get("file_path")
        mime_type = data.get("mime_type", "video/mp4")
        upload_id_str = data.get("upload_id")
        run_id_str = data.get("run_id")

        if not video_id_str or not file_path or not upload_id_str or not run_id_str:
            return

        video_id = uuid.UUID(video_id_str)
        upload_id = uuid.UUID(upload_id_str)
        run_id = uuid.UUID(run_id_str)

        async with get_db_connection() as conn:
            params = CreateGenerationAndLinkSqlParams(
                video_id=video_id,
                file_path=file_path,
                mime_type=mime_type,
                upload_id=upload_id,
                active=True,
                run_id=run_id,
            )
            await execute_sql_typed(conn, SQL_PATH_VIDEO_COMPLETE, params=params)
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Failed to complete video generation")


async def _handle_text_complete(data: dict[str, Any], sid: str) -> None:
    """Handle text completion - log run pricing and metrics directly."""
    try:
        run_id_str = data.get("run_id")
        resource_type = data.get("resource_type", "text")
        input_text_tokens = data.get("input_text_tokens")
        output_text_tokens = data.get("output_text_tokens")
        system_prompt = data.get("system_prompt")
        input_items = data.get("input_items")
        assistant_output = data.get("assistant_output")
        department_id_str = data.get("department_id")

        if not run_id_str or input_text_tokens is None or output_text_tokens is None:
            return

        run_id = uuid.UUID(run_id_str)
        department_id = uuid.UUID(department_id_str) if department_id_str else None

        # Extract developer message contents from input_items
        developer_contents: list[str] = []
        if input_items:
            for item in input_items:
                if isinstance(item, dict):
                    role = item.get("role")
                    if role == "developer":
                        content = item.get("content")
                        if isinstance(content, str):
                            stripped = content.strip()
                            if stripped:
                                developer_contents.append(stripped)

        async with get_db_connection() as conn:
            # Use execute_sql_typed() with auto-generated types
            params_dict = {
                "run_id": run_id,
                "input_text_tokens": input_text_tokens,
                "input_audio_tokens": 0,
                "input_image_tokens": 0,
                "output_text_tokens": output_text_tokens,
                "output_audio_tokens": 0,
                "cached_text_tokens": 0,
                "cached_audio_tokens": 0,
                "department_id": department_id,  # Can be None, SQL handles NULL
                "developer_contents": developer_contents,
                "assistant_output": assistant_output or "",
            }
            # Use model_construct to bypass validation for optional fields until types are regenerated
            params = LogRunSqlParams.model_construct(**params_dict)  # type: ignore
            result = cast(
                LogRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH_LOG_RUN, params=params),
            )

            # Log activity (only for client-to-server events, not internal)
            if sid and sid != "" and sid != "internal":
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="websocket.log",
                        template="{{ actor.name }} logged run",
                        context={
                            "run_id": run_id_str,
                            "operation_type": resource_type,
                        },
                        endpoint="/socket/v4/log",
                        error=False,
                    )
                except Exception:
                    pass

            # Always save OpenAI messages as JSON file
            try:
                messages: list[dict[str, str]] = []

                # Add system message if provided
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})

                # Add developer messages from input_items
                if input_items:
                    for item in input_items:
                        if isinstance(item, dict):
                            role = item.get("role")
                            if role == "developer":
                                content = item.get("content")
                                if isinstance(content, str) and content.strip():
                                    messages.append(
                                        {
                                            "role": "developer",
                                            "content": content.strip(),
                                        }
                                    )

                # Add assistant message if provided
                if assistant_output and assistant_output.strip():
                    messages.append(
                        {"role": "assistant", "content": assistant_output.strip()}
                    )

                # Save to JSON file
                if messages:
                    json_file_path = UPLOAD_FOLDER / f"{run_id}.json"
                    with open(json_file_path, "w", encoding="utf-8") as f:
                        json.dump(messages, f, indent=2, ensure_ascii=False)
            except Exception:
                # Log error but don't fail the request
                pass
    except Exception:
        # Don't emit error to client - pricing is async and failures are logged
        import logging

        logging.getLogger(__name__).warning("Failed to log run for text completion")


async def _handle_tool_call_template_rendering(call_id: str) -> dict[str, Any] | None:
    """Handle tool call template rendering for tool_call_complete events."""
    try:
        async with get_db_connection() as conn:
            # Get calls record by external_call_id
            call_record = await conn.fetchrow(
                """
                SELECT id, tool_id, template_id, arguments_raw
                FROM calls
                WHERE external_call_id = $1
                LIMIT 1
                """,
                call_id,
            )

            if not call_record or not call_record["tool_id"]:
                return None

            call_uuid = call_record["id"]
            tool_id = call_record["tool_id"]
            template_id = call_record["template_id"]
            arguments_raw = call_record["arguments_raw"]

            # Parse arguments_raw JSON
            try:
                tool_arguments = json.loads(arguments_raw) if arguments_raw else {}
            except json.JSONDecodeError:
                tool_arguments = {}

            # Render templates using existing render_tool_template function
            rendered_values = await render_tool_template(conn, tool_id, tool_arguments)

            # Store rendered values in template_values table
            if rendered_values and template_id:
                # Get schema_fields for this tool's output schema
                schema_fields = await conn.fetch(
                    """
                    SELECT sf.id, sf.name, sf.field_type
                    FROM schema_fields sf
                    JOIN schemas s ON s.id = sf.schema_id
                    JOIN schema_templates st ON st.schema_id = s.id
                    WHERE st.template_id = $1
                    ORDER BY sf.position
                    """,
                    template_id,
                )

                # Insert/update template_values
                for field in schema_fields:
                    field_name = field["name"]
                    if field_name in rendered_values:
                        value = rendered_values[field_name]
                        field_type = field["field_type"]

                        # Upsert template_value
                        await conn.execute(
                            """
                            INSERT INTO template_values (
                                template_id,
                                schema_field_id,
                                call_id,
                                string_value,
                                number_value,
                                boolean_value,
                                active,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                $1, $2, $3,
                                CASE WHEN $4 = 'string' THEN $5::text ELSE NULL END,
                                CASE WHEN $4 = 'number' THEN $6::numeric ELSE NULL END,
                                CASE WHEN $4 = 'boolean' THEN $7::boolean ELSE NULL END,
                                true, NOW(), NOW()
                            )
                            ON CONFLICT (template_id, schema_field_id)
                            DO UPDATE SET
                                string_value = CASE WHEN $4 = 'string' THEN $5::text ELSE template_values.string_value END,
                                number_value = CASE WHEN $4 = 'number' THEN $6::numeric ELSE template_values.number_value END,
                                boolean_value = CASE WHEN $4 = 'boolean' THEN $7::boolean ELSE template_values.boolean_value END,
                                updated_at = NOW()
                            """,
                            template_id,
                            field["id"],
                            call_uuid,
                            field_type,
                            value if field_type == "string" else None,
                            value if field_type == "number" else None,
                            value if field_type == "boolean" else None,
                        )

            return rendered_values
    except Exception as template_error:
        # Log error but don't fail the completion flow
        from utils.logging.db_logger import get_logger

        logger = get_logger(__name__)
        logger.warning(
            f"Failed to render tool templates for call_id {call_id}: {str(template_error)}"
        )
        return None


async def _execute_tool_call(
    conn: asyncpg.Connection,
    call_id: str,
    tool_name: str,
    resource_type: str,
    group_id: uuid.UUID | None,
    agent_id: uuid.UUID,
) -> uuid.UUID | None:
    """Execute tool to create resource record using existing call record.
    
    Since SQL functions like api_create_personas_v4 create NEW call records,
    we create the resource record directly and link it to the existing call_id.
    
    Returns created resource_id or None if execution failed.
    """
    try:
        # Get calls record
        call_record = await conn.fetchrow(
            """
            SELECT id, tool_id, arguments_raw
            FROM calls
            WHERE external_call_id = $1
            LIMIT 1
            """,
            call_id,
        )

        if not call_record:
            logger.warning(f"Call record not found for call_id: {call_id}")
            return None

        call_uuid = call_record["id"]
        tool_id = call_record["tool_id"]

        # Get resource type from resource_tools to verify tool is for this resource
        resource_check = await conn.fetchrow(
            """
            SELECT rt.resource::text as resource_type
            FROM resource_tools rt
            WHERE rt.tool_id = $1
            LIMIT 1
            """,
            tool_id,
        )

        if not resource_check or resource_check["resource_type"] != resource_type:
            logger.warning(
                f"Tool {tool_id} is not for resource type {resource_type}"
            )
            return None

        # Create resource record directly, linking to existing call_id
        # Each resource table has different columns, so we need to handle them differently
        # For now, we'll create a minimal record with call_id linkage
        
        # Get rendered template values to use for resource creation
        template_values = await conn.fetch(
            """
            SELECT sf.name, tv.string_value, tv.number_value, tv.boolean_value, sf.field_type
            FROM template_values tv
            JOIN schema_fields sf ON sf.id = tv.schema_field_id
            WHERE tv.call_id = $1
            ORDER BY sf.position
            """,
            call_uuid,
        )

        # Build resource data from template values
        resource_data: dict[str, Any] = {}
        if template_values:
            # Use rendered template values
            for tv in template_values:
                field_name = tv["name"]
                if tv["field_type"] == "string":
                    resource_data[field_name] = tv["string_value"]
                elif tv["field_type"] == "number":
                    resource_data[field_name] = tv["number_value"]
                elif tv["field_type"] == "boolean":
                    resource_data[field_name] = tv["boolean_value"]
        else:
            # Fallback: parse arguments_raw and use directly (no template rendering)
            # This should rarely happen if template rendering worked correctly
            arguments_raw = call_record["arguments_raw"]
            try:
                parsed_args = json.loads(arguments_raw) if arguments_raw else {}
                resource_data = parsed_args
                logger.info(
                    f"Using arguments_raw directly for {resource_type} (no template_values found)"
                )
            except json.JSONDecodeError:
                logger.warning(
                    f"Failed to parse arguments_raw for {resource_type}: {arguments_raw}"
                )
                return None

        # Map resource_type to table name and create record
        # Note: This is a simplified approach - in production, you might want
        # to use the SQL functions but modify them to accept existing call_id
        resource_id = await _create_resource_record(
            conn=conn,
            resource_type=resource_type,
            call_id=call_uuid,
            resource_data=resource_data,
            mcp=False,
        )

        return resource_id
    except Exception as exec_error:
        logger.error(
            f"Failed to execute tool call {call_id}: {str(exec_error)}",
            exc_info=True,
        )
        return None


async def _create_resource_record(
    conn: asyncpg.Connection,
    resource_type: str,
    call_id: uuid.UUID,
    resource_data: dict[str, Any],
    mcp: bool = False,
) -> uuid.UUID | None:
    """Create resource record in the appropriate table.
    
    This is a simplified implementation. In production, you might want to
    use the SQL functions but modify them to accept existing call_id, or
    create resource-specific handlers.
    """
    try:
        # Map resource_type to table and required columns
        # Columns are ordered: required fields first, then optional with defaults
        # Note: Field names in resource_data come from rendered template values (schema field names)
        resource_table_map: dict[str, tuple[str, list[str]]] = {
            "personas": ("personas", ["active", "generated", "mcp", "call_id"]),
            "names": ("names", ["name", "active", "generated", "call_id", "mcp"]),
            "descriptions": ("descriptions", ["description", "active", "generated", "call_id", "mcp"]),
            "colors": ("colors", ["name", "description", "hex_code", "active", "generated", "call_id", "mcp"]),
            "icons": ("icons", ["name", "description", "value", "active", "generated", "call_id", "mcp"]),
            "instructions": ("instructions", ["template", "active", "generated", "call_id", "mcp"]),
            "flags": ("flags", ["name", "description", "icon_id", "active", "generated", "call_id", "mcp"]),
            "examples": ("examples", ["example", "generated", "call_id", "mcp"]),
            "fields": ("fields", ["active", "generated", "mcp", "call_id"]),
            "departments": ("departments", ["active", "generated", "mcp", "call_id"]),
        }

        if resource_type not in resource_table_map:
            logger.warning(f"Unknown resource type: {resource_type}")
            return None

        table_name, columns = resource_table_map[resource_type]

        # Build INSERT query dynamically
        # Extract values from resource_data based on column names
        insert_columns: list[str] = []
        insert_values: list[str] = []
        value_params: list[Any] = []

        param_idx = 1
        for col in columns:
            if col == "call_id":
                insert_columns.append(col)
                insert_values.append(f"${param_idx}")
                value_params.append(call_id)  # type: ignore[list-item]
                param_idx += 1
            elif col == "active":
                insert_columns.append(col)
                insert_values.append(f"${param_idx}")
                value_params.append(True)  # type: ignore[list-item]
                param_idx += 1
            elif col == "generated":
                insert_columns.append(col)
                insert_values.append(f"${param_idx}")
                value_params.append(True)  # type: ignore[list-item]
                param_idx += 1
            elif col == "mcp":
                insert_columns.append(col)
                insert_values.append(f"${param_idx}")
                value_params.append(mcp)  # type: ignore[list-item]
                param_idx += 1
            elif col in resource_data and resource_data[col] is not None:
                # Use value from rendered template values
                insert_columns.append(col)
                insert_values.append(f"${param_idx}")
                value_params.append(resource_data[col])  # type: ignore[list-item]
                param_idx += 1
            elif col not in ["call_id", "active", "generated", "mcp"]:
                # Required field not in resource_data - try to find it with different field name mappings
                # Template values use schema field names which may differ from table column names
                field_mappings: dict[str, list[str]] = {
                    "name": ["name"],
                    "description": ["description"],
                    "hex_code": ["hex_code", "color", "hex"],
                    "value": ["value", "icon"],
                    "template": ["template", "instruction"],
                    "example": ["example"],
                    "icon_id": ["icon_id", "icon"],
                }
                
                found_value = None
                if col in field_mappings:
                    for possible_field in field_mappings[col]:
                        if possible_field in resource_data:
                            found_value = resource_data[possible_field]
                            break
                
                if found_value is not None:
                    insert_columns.append(col)
                    insert_values.append(f"${param_idx}")
                    value_params.append(found_value)  # type: ignore[list-item]
                    param_idx += 1
                else:
                    # Required field not found - use defaults or empty values
                    logger.warning(
                        f"Required field '{col}' not found in resource_data for {resource_type}, using default"
                    )
                    if col in ["name", "description", "template", "example", "value"]:
                        insert_columns.append(col)
                        insert_values.append(f"${param_idx}")
                        value_params.append("")  # type: ignore[list-item]
                        param_idx += 1
                    elif col == "hex_code":
                        insert_columns.append(col)
                        insert_values.append(f"${param_idx}")
                        value_params.append("#000000")  # type: ignore[list-item]
                        param_idx += 1
                    elif col == "icon_id":
                        # icon_id is optional for flags, skip if not found
                        pass
                    # Skip other columns - they may have database defaults

        if not insert_columns:
            logger.warning(f"No columns to insert for {resource_type}")
            return None

        # Execute INSERT and return resource_id
        query = f"""
            INSERT INTO {table_name} ({', '.join(insert_columns)})
            VALUES ({', '.join(insert_values)})
            RETURNING id
        """

        result = await conn.fetchrow(query, *value_params)
        if result and result["id"]:
            return uuid.UUID(str(result["id"]))

        return None
    except Exception as create_error:
        logger.error(
            f"Failed to create {resource_type} record: {str(create_error)}",
            exc_info=True,
        )
        return None


# Note: register_server_endpoint requires a type, but we handle multiple event types
# The endpoint registration is handled by the @internal_sio.on decorators above

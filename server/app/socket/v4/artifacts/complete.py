"""Artifact completion handler - listens to internal completion events and routes by modality."""

import json
import uuid
from typing import Any, cast

import asyncpg
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.artifacts.discovery import (
    get_resource_table_columns, map_template_values_to_table_columns)
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
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_IMAGE_COMPLETE = "app/sql/v4/queries/images/complete_image_generation_complete.sql"
SQL_PATH_VIDEO_COMPLETE = "app/sql/v4/queries/videos/create_generation_and_link_complete.sql"
SQL_PATH_LOG_RUN = "app/sql/v4/queries/model_runs/log_run_complete.sql"


@internal_sio.on("generate_complete")  # type: ignore
async def handle_artifact_complete(data: dict[str, Any]) -> None:
    """Route completion events by output modality and handle SQL operations."""
    # Extract modality and artifact_type from payload
    modality = data.get("modality", "text")
    artifact_type = data.get("artifact_type")
    eval_mode = data.get("eval_mode", False)  # Extract eval_mode flag

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    completion_type = data.get("type", "run_complete")

    # Handle tool_call_complete template rendering and tool execution if applicable
    rendered_values: dict[str, Any] | None = None
    resource_id: uuid.UUID | None = None
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
                            # Store resource_id in data for client payload
                            data["resource_id"] = str(resource_id)
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

    # Re-emit resource_complete with enriched data for resource handlers
    # Only include fields that resource handlers (like personas/complete.py) actually need
    resource_type = data.get("resource_type", "text")
    
    # Build minimal payload with only fields needed by resource handlers
    enriched_payload: dict[str, Any] = {
        "sid": sid,
        "artifact_type": artifact_type,
        "group_id": data.get("group_id"),
        "resource_id": data.get("resource_id"),  # Added if created from tool execution
        "resource_type": resource_type,
        "run_id": data.get("run_id"),
        "type": completion_type,
        "eval_mode": eval_mode,  # Add eval_mode flag
    }

    # Re-emit resource_complete for resource handlers to process
    await internal_sio.emit("resource_complete", enriched_payload)

    # Transform internal event format to client format
    client_payload = _build_client_payload(modality, completion_type, data, artifact_type)
    
    # Include sid for internal handlers that listen to client-facing events
    client_payload["sid"] = sid
    client_payload["eval_mode"] = eval_mode  # Add eval_mode flag

    # Emit unified client event
    await sio.emit(
        "artifact_generation_complete",
        client_payload,
        room=sid,
    )


def _build_client_payload(
    modality: str, completion_type: str, data: dict[str, Any], artifact_type: str | None
) -> dict[str, Any]:
    """Build client payload based on modality."""
    client_payload: dict[str, Any] = {
        "modality": modality,
        "artifact_type": artifact_type,
        "resource_type": data.get("resource_type"),
        "run_id": data.get("run_id"),
        "group_id": data.get("group_id"),
        "type": completion_type,
    }
    
    # Include resource_id if available (from tool_call_complete)
    if "resource_id" in data:
        client_payload["resource_id"] = data.get("resource_id")

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
            from utils.sql_helper import _detect_function_in_sql, load_sql

            # Get calls record by external_call_id
            sql_path_call = "app/sql/v4/queries/artifacts/complete/get_call_by_external_id_complete.sql"
            sql_text_call = load_sql(sql_path_call)
            is_function_call, function_name_call, schema_call = _detect_function_in_sql(sql_text_call)
            
            if is_function_call and function_name_call:
                function_call_sql = f'SELECT * FROM "{schema_call}"."{function_name_call}"($1::text)'
                call_record = await conn.fetchrow(function_call_sql, call_id)
            else:
                call_record = await conn.fetchrow(sql_text_call, call_id)

            if not call_record or not call_record.get("tool_id"):
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
                sql_path_schema = "app/sql/v4/queries/artifacts/complete/get_schema_fields_by_template_id_complete.sql"
                sql_text_schema = load_sql(sql_path_schema)
                is_function_schema, function_name_schema, schema_schema = _detect_function_in_sql(sql_text_schema)
                
                if is_function_schema and function_name_schema:
                    function_call_sql = f'SELECT * FROM "{schema_schema}"."{function_name_schema}"($1::uuid)'
                    schema_fields = await conn.fetch(function_call_sql, template_id)
                else:
                    schema_fields = await conn.fetch(sql_text_schema, template_id)

                # Upsert template_values using SQL function
                sql_path_upsert = "app/sql/v4/queries/artifacts/complete/upsert_template_value_complete.sql"
                sql_text_upsert = load_sql(sql_path_upsert)
                is_function_upsert, function_name_upsert, schema_upsert = _detect_function_in_sql(sql_text_upsert)
                
                for field in schema_fields:
                    field_name = field["name"]
                    if field_name in rendered_values:
                        value = rendered_values[field_name]
                        field_type = field["field_type"]

                        # Upsert template_value using SQL function
                        if is_function_upsert and function_name_upsert:
                            upsert_sql = f'SELECT * FROM "{schema_upsert}"."{function_name_upsert}"($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::numeric, $7::boolean)'
                            await conn.fetchrow(
                                upsert_sql,
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
        from utils.sql_helper import _detect_function_in_sql, load_sql

        # Get calls record
        sql_path_call = "app/sql/v4/queries/artifacts/complete/get_call_by_external_id_complete.sql"
        sql_text_call = load_sql(sql_path_call)
        is_function_call, function_name_call, schema_call = _detect_function_in_sql(sql_text_call)
        
        if is_function_call and function_name_call:
            function_call_sql = f'SELECT * FROM "{schema_call}"."{function_name_call}"($1::text)'
            call_record = await conn.fetchrow(function_call_sql, call_id)
        else:
            call_record = await conn.fetchrow(sql_text_call, call_id)

        if not call_record:
            logger.warning(f"Call record not found for call_id: {call_id}")
            return None

        call_uuid = call_record["id"]
        tool_id = call_record["tool_id"]

        # Skip resource type verification - tools are already filtered by resource_type
        # when fetched in get_text_run_context_and_create_run_complete.sql, so if a tool
        # made it through that filter, it's valid for the given resource_type.
        # The resource_type parameter passed here is authoritative.

        # Get rendered template values to use for resource creation
        sql_path_template = "app/sql/v4/queries/artifacts/complete/get_template_values_by_call_id_complete.sql"
        sql_text_template = load_sql(sql_path_template)
        is_function_template, function_name_template, schema_template = _detect_function_in_sql(sql_text_template)
        
        if is_function_template and function_name_template:
            function_call_sql = f'SELECT * FROM "{schema_template}"."{function_name_template}"($1::uuid)'
            template_values = await conn.fetch(function_call_sql, call_uuid)
        else:
            template_values = await conn.fetch(sql_text_template, call_uuid)

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

        # Create resource record using dynamic discovery
        resource_id = await _create_resource_record(
            conn=conn,
            resource_type=resource_type,
            call_id=call_uuid,
            resource_data=resource_data,
            mcp=False,
            tool_id=str(tool_id),
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
    tool_id: str | None = None,
) -> uuid.UUID | None:
    """Create resource record in the appropriate table using dynamic discovery.
    
    Dynamically discovers table columns and maps template values to columns.
    No hardcoded mappings required - all discovery is database-driven.
    """
    try:
        # Discover table columns dynamically
        table_columns = await get_resource_table_columns(conn, resource_type)
        
        if not table_columns:
            logger.warning(f"No columns found for resource type: {resource_type}")
            return None
        
        # Map template values to table columns
        mapped_data = await map_template_values_to_table_columns(
            conn, resource_type, resource_data, tool_id
        )
        
        # Use SQL function to create resource record dynamically
        import json

        from utils.sql_helper import _detect_function_in_sql, load_sql
        
        sql_path = "app/sql/v4/queries/artifacts/complete/create_resource_record_complete.sql"
        sql_text = load_sql(sql_path)
        is_function, function_name, schema = _detect_function_in_sql(sql_text)
        
        # Convert resource_data to JSONB for the function
        resource_data_jsonb = json.dumps(mapped_data)
        
        if is_function and function_name:
            function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"($1::text, $2::uuid, $3::boolean, $4::jsonb)'
            result = await conn.fetchrow(
                function_call_sql,
                resource_type,
                call_id,
                mcp,
                resource_data_jsonb,
            )
        else:
            # Fallback to raw SQL (shouldn't happen)
            result = await conn.fetchrow(sql_text, resource_type, call_id, mcp, resource_data_jsonb)
        
        if result and result.get("id"):
            resource_id = uuid.UUID(str(result["id"]))
            return resource_id
        
        return None
    except Exception as create_error:
        logger.error(
            f"Failed to create {resource_type} record: {str(create_error)}",
            exc_info=True,
        )
        return None


# Note: register_server_endpoint requires a type, but we handle multiple event types
# The endpoint registration is handled by the @internal_sio.on decorators above

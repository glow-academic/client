"""Artifact completion handler - listens to internal completion events and routes by modality."""

import json
import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.tools.render_tool_template import render_tool_template
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.sql.types import (
    CompleteImageGenerationSqlParams,
    CompleteImageGenerationSqlRow,
    CreateGenerationAndLinkSqlParams,
    CreateGenerationAndLinkSqlRow,
    LogRunSqlParams,
    LogRunSqlRow,
)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_IMAGE_COMPLETE = "app/sql/v4/images/complete_image_generation_complete.sql"
SQL_PATH_VIDEO_COMPLETE = "app/sql/v4/videos/create_generation_and_link_complete.sql"
SQL_PATH_LOG_RUN = "app/sql/v4/model_runs/log_run_complete.sql"

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
    
    # Handle tool_call_complete template rendering if applicable
    rendered_values: dict[str, Any] | None = None
    if completion_type == "tool_call_complete":
        call_id = data.get("call_id")
        if call_id:
            rendered_values = await _handle_tool_call_template_rendering(call_id)
    
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
        client_payload.update({
            "input_text_tokens": data.get("input_text_tokens"),
            "output_text_tokens": data.get("output_text_tokens"),
            "system_prompt": data.get("system_prompt"),
            "assistant_output": data.get("assistant_output"),
        })
    elif modality == "image":
        client_payload.update({
            "image_id": data.get("image_id"),
            "file_path": data.get("file_path"),
            "mime_type": data.get("mime_type"),
            "file_size": data.get("file_size"),
        })
    elif modality == "video":
        client_payload.update({
            "success": data.get("success", True),
            "message": data.get("message"),
            "videoUrl": data.get("videoUrl"),
            "video_id": data.get("video_id"),
        })
    elif modality == "audio":
        client_payload.update({
            "model": data.get("model"),
        })
    
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
                                        {"role": "developer", "content": content.strip()}
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
            # Get tool_id from call_id
            tool_call_record = await conn.fetchrow(
                """
                SELECT tool_id, id as tool_call_id
                FROM calls
                WHERE call_id = $1
                LIMIT 1
                """,
                call_id,
            )
            
            if not tool_call_record or not tool_call_record["tool_id"]:
                return None
            
            tool_id = tool_call_record["tool_id"]
            tool_call_id_uuid = tool_call_record["tool_call_id"]
            
            # Get tool arguments from tool_call_arguments
            arguments_record = await conn.fetchrow(
                """
                SELECT arguments_json
                FROM tool_call_arguments
                WHERE tool_call_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                tool_call_id_uuid,
            )
            
            if not arguments_record or not arguments_record["arguments_json"]:
                return None
            
            tool_arguments = arguments_record["arguments_json"]
            if isinstance(tool_arguments, str):
                tool_arguments = json.loads(tool_arguments)
            
            # Render templates
            rendered_values = await render_tool_template(
                conn, tool_id, tool_arguments
            )
            
            # Store rendered values in tool_call_results if any were rendered
            if rendered_values:
                # Delete existing result if any, then insert new one
                await conn.execute(
                    """
                    DELETE FROM tool_call_results
                    WHERE tool_call_id = $1
                    """,
                    tool_call_id_uuid,
                )
                await conn.execute(
                    """
                    INSERT INTO tool_call_results (
                        tool_call_id,
                        result_content,
                        result_json,
                        created_at
                    )
                    VALUES ($1, $2, $3, NOW())
                    """,
                    tool_call_id_uuid,
                    json.dumps(rendered_values),
                    json.dumps(rendered_values),
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


# Note: register_server_endpoint requires a type, but we handle multiple event types
# The endpoint registration is handled by the @internal_sio.on decorators above

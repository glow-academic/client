"""Artifact progress handler - listens to internal progress events and routes by modality."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (GetImageGenerationContextAndCreateUploadSqlParams,
                           GetImageGenerationContextAndCreateUploadSqlRow,
                           GetVideoRunContextAndCreateRunSqlParams,
                           GetVideoRunContextAndCreateRunSqlRow,
                           InfraArtifactsGetGroupIdFromRunSqlParams,
                           InfraArtifactsGetGroupIdFromRunSqlRow,
                           InsertUploadSqlParams, InsertUploadSqlRow,
                           TextToolProgressUpdateSqlParams,
                           TextToolProgressUpdateSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_TEXT_TOOL_PROGRESS = (
    "app/sql/v4/generate/text/text_tool_progress_update_complete.sql"
)
SQL_PATH_IMAGE = (
    "app/sql/v4/images/get_image_generation_context_and_create_upload_complete.sql"
)
SQL_PATH_VIDEO = "app/sql/v4/videos/get_video_run_context_and_create_run_complete.sql"
GET_GROUP_ID_SQL_PATH = "app/sql/v4/infrastructure/artifacts/get_group_id_from_run_complete.sql"
SQL_PATH_UPLOAD = "app/sql/v4/uploads/insert_upload_complete.sql"


@internal_sio.on("generate_progress")  # type: ignore
async def handle_artifact_progress(data: dict[str, Any]) -> None:
    """Route progress events by output modality and handle SQL operations."""
    # Extract modality and artifact_type from payload
    modality = data.get("modality", "text")
    artifact_type = data.get("artifact_type")
    eval_mode = data.get("eval_mode", False)  # Extract eval_mode flag

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Handle SQL operations based on progress type
    progress_type = data.get("type", "")

    # Handle text tool progress SQL operations
    if modality == "text" and progress_type in (
        "tool_call_start",
        "tool_call_progress",
        "tool_call_complete",
    ):
        await _handle_text_tool_progress(data)

    # Handle image start SQL operation
    elif modality == "image" and progress_type == "start":
        await _handle_image_start(data)

    # Handle video start SQL operations
    elif modality == "video" and progress_type == "start":
        await _handle_video_start(data)

    # Transform internal event format to client format
    client_type, message = _map_progress_type_to_client(progress_type, modality, data)

    # Emit unified client event
    await sio.emit(
        "artifact_generation_progress",
        {
            "modality": modality,
            "artifact_type": artifact_type,
            "resource_type": data.get("resource_type"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "type": client_type,
            "message": message,
            "text": data.get("text"),  # For token events
            "tool_call_id": data.get("tool_call_id"),
            "tool_name": data.get("tool_name"),
            "arguments": data.get("arguments"),
            "arguments_delta": data.get("arguments_delta"),
            "status": data.get("status"),
            "progress": data.get("progress"),
            "ephemeral_key": data.get(
                "ephemeral_key"
            ),  # For audio session (deprecated)
            "expires_in": data.get("expires_in"),  # For audio session (deprecated)
            "model": data.get("model"),  # For audio session
            "trace_id": data.get("trace_id"),
            # Audio-specific fields
            "item_id": data.get("item_id"),
            "audio_start_ms": data.get("audio_start_ms"),
            "transcript": data.get("transcript"),
            "response_id": data.get("response_id"),
            "output_type": data.get("output_type"),
            "audio": data.get("audio"),  # Base64 audio data
            "call_id": data.get("call_id"),
            "function_call": data.get("function_call"),
            "eval_mode": eval_mode,  # Add eval_mode flag
        },
        room=sid,
    )

    # Re-emit resource_progress with enriched data for resource handlers
    # Build minimal payload with only fields needed by resource handlers
    resource_type = data.get("resource_type", "text")
    enriched_payload: dict[str, Any] = {
        "sid": sid,
        "modality": modality,
        "artifact_type": artifact_type,
        "group_id": data.get("group_id"),
        "resource_type": resource_type,
        "resource_id": data.get("resource_id"),
        "run_id": data.get("run_id"),
        "type": progress_type,
        "message": message,
        "text": data.get("text"),
        "tool_call_id": data.get("tool_call_id"),
        "tool_name": data.get("tool_name"),
        "arguments": data.get("arguments"),
        "arguments_delta": data.get("arguments_delta"),
        "status": data.get("status"),
        "progress": data.get("progress"),
        "ephemeral_key": data.get("ephemeral_key"),
        "expires_in": data.get("expires_in"),
        "model": data.get("model"),
        "trace_id": data.get("trace_id"),
        "item_id": data.get("item_id"),
        "audio_start_ms": data.get("audio_start_ms"),
        "transcript": data.get("transcript"),
        "response_id": data.get("response_id"),
        "output_type": data.get("output_type"),
        "audio": data.get("audio"),
        "call_id": data.get("call_id"),
        "function_call": data.get("function_call"),
        "eval_mode": eval_mode,  # Add eval_mode flag
    }

    # Re-emit resource_progress for resource handlers to process
    await internal_sio.emit("resource_progress", enriched_payload)


def _map_progress_type_to_client(
    progress_type: str, modality: str, data: dict[str, Any]
) -> tuple[str, str | None]:
    """Map internal progress type to client format."""
    if progress_type == "tool_call_start":
        return "tool_call", f"Starting {data.get('tool_name', 'tool')}..."
    elif progress_type == "tool_call_progress":
        return "tool_call", f"Generating {data.get('tool_name', 'tool')}..."
    elif progress_type == "tool_call_complete":
        return "tool_call", f"Completed {data.get('tool_name', 'tool')}..."
    elif progress_type == "token":
        return "token", None  # Text is streamed directly
    elif progress_type == "start":
        return "start", data.get("message", f"Starting {modality} generation...")
    elif progress_type == "polling":
        return "status", data.get("message", "Processing...")
    elif progress_type == "session_started" or progress_type == "session_created":
        return "session_started", "Audio session started"
    elif progress_type in (
        "user_speech_started",
        "user_speech_stopped",
        "user_transcription_complete",
        "response_started",
        "output_item_added",
        "output_item_done",
        "audio_transcript_delta",
        "audio_transcript_done",
        "audio_delta",
    ):
        # Audio-specific events - pass through with original type
        return progress_type, data.get("message")
    else:
        return "progress", data.get("message", "Processing...")


async def _handle_text_tool_progress(data: dict[str, Any]) -> None:
    """Handle text tool progress SQL operations."""
    try:
        run_id_str = data.get("run_id")
        tool_call_id = data.get("tool_call_id")
        progress_type = data.get("type", "")

        if not run_id_str or not tool_call_id:
            return

        run_id = uuid.UUID(run_id_str)

        # Map progress_type to SQL progress_type
        sql_progress_type = "tool_call_start"
        if progress_type == "tool_call_progress":
            sql_progress_type = "tool_call_progress"
        elif progress_type == "tool_call_complete":
            sql_progress_type = "tool_call_complete"

        async with get_db_connection() as conn:
            # Get group_id from run (resource_id no longer needed)
            group_params = InfraArtifactsGetGroupIdFromRunSqlParams(
                run_id=uuid.UUID(run_id)
            )
            group_result = cast(
                InfraArtifactsGetGroupIdFromRunSqlRow,
                await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params),
            )
            group_id = str(group_result.group_id) if group_result and group_result.group_id else None
            
            progress_params = TextToolProgressUpdateSqlParams(
                run_id=run_id,
                tool_call_id=tool_call_id,
                progress_type=sql_progress_type,
                call_id=tool_call_id,
                tool_name=data.get("tool_name"),
                arguments_delta=data.get("arguments_delta")
                or data.get("arguments")
                or "",
            )
            result = cast(
                TextToolProgressUpdateSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_TEXT_TOOL_PROGRESS, params=progress_params
                ),
            )
            # Mark call as completed when tool_call_complete
            if sql_progress_type == "tool_call_complete" and result.persisted_call_id:
                from utils.sql_helper import _detect_function_in_sql, load_sql
                
                sql_path = "app/sql/v4/artifacts/progress/mark_call_completed_complete.sql"
                sql_text = load_sql(sql_path)
                is_function, function_name, schema = _detect_function_in_sql(sql_text)
                
                if is_function and function_name:
                    function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"($1::text)'
                    await conn.fetchrow(function_call_sql, result.persisted_call_id)
                else:
                    await conn.execute(sql_text, result.persisted_call_id)
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Failed to persist tool progress")


async def _handle_image_start(data: dict[str, Any]) -> None:
    """Handle image start SQL operation - create upload record."""
    try:
        image_id_str = data.get("image_id")
        agent_id_str = data.get("agent_id")
        profile_id_str = data.get("profile_id")
        department_id_str = data.get("department_id")

        if not image_id_str or not agent_id_str:
            return

        image_id = uuid.UUID(image_id_str)
        agent_id = uuid.UUID(agent_id_str)
        profile_id = uuid.UUID(profile_id_str) if profile_id_str else None
        department_id = uuid.UUID(department_id_str) if department_id_str else None

        async with get_db_connection() as conn:
            params = GetImageGenerationContextAndCreateUploadSqlParams(
                image_id=image_id,
                agent_id=agent_id,
                profile_id=profile_id,
                department_id=department_id,
            )
            result = cast(
                GetImageGenerationContextAndCreateUploadSqlRow,
                await execute_sql_typed(conn, SQL_PATH_IMAGE, params=params),
            )

            # Note: This creates the upload record. The API key and model info are also returned
            # but generate.py needs them before emitting start, so this will be called from generate.py
            # before the start event is emitted. This handler is here for future refactoring.
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Failed to create image upload record")


async def _handle_video_start(data: dict[str, Any]) -> None:
    """Handle video start SQL operations - create upload record and run context."""
    try:
        video_id_str = data.get("video_id")
        profile_id_str = data.get("profile_id")

        if not video_id_str or not profile_id_str:
            return

        video_id = uuid.UUID(video_id_str)
        profile_id = uuid.UUID(profile_id_str)

        async with get_db_connection() as conn:
            # Create upload record first
            sql_query = load_sql(SQL_PATH_UPLOAD)
            upload_params = InsertUploadSqlParams(
                file_path="",  # Will be set during persistence
                mime_type="video/mp4",
                size=0,  # Will be updated after generation
            )
            upload_result = cast(
                InsertUploadSqlRow,
                await execute_sql_typed(conn, sql_query, params=upload_params),
            )

            if not upload_result or not upload_result.id:
                return

            upload_id = uuid.UUID(upload_result.id)

            # Get video context from SQL
            params = GetVideoRunContextAndCreateRunSqlParams(
                video_id=video_id,
                profile_id=profile_id,
            )
            result = cast(
                GetVideoRunContextAndCreateRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH_VIDEO, params=params),
            )

            # Note: Similar to image, this creates upload and gets context.
            # generate.py needs the API key before emitting start, so this will be called
            # from generate.py before the start event is emitted. This handler is here for future refactoring.
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "Failed to create video upload record or run context"
        )


# Note: register_server_endpoint requires a type, but we handle unified events
# The endpoint registration is handled by the @internal_sio.on decorator above

"""Artifact completion handler - listens to internal completion events and routes by modality."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    CompleteImageGenerationSqlParams,
    CompleteImageGenerationSqlRow,
    CreateGenerationAndLinkSqlParams,
    CreateGenerationAndLinkSqlRow,
)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_IMAGE_COMPLETE = "app/sql/v4/images/complete_image_generation_complete.sql"
SQL_PATH_VIDEO_COMPLETE = "app/sql/v4/videos/create_generation_and_link_complete.sql"


@internal_sio.on("generate_complete")  # type: ignore
async def handle_artifact_complete(data: dict[str, Any]) -> None:
    """Route completion events by output modality and handle SQL operations."""
    # Extract modality from payload
    modality = data.get("modality", "text")
    
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    completion_type = data.get("type", "run_complete")
    
    # Handle SQL operations based on modality
    if completion_type == "run_complete":
        if modality == "image":
            await _handle_image_complete(data)
        elif modality == "video":
            await _handle_video_complete(data)
        elif modality in ("text", "call", "document"):
            await _handle_text_complete(data)
    
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


async def _handle_text_complete(data: dict[str, Any]) -> None:
    """Handle text completion - emit log_run for cost logging."""
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
        
        # Emit log_run event for cost logging (handled by log.py)
        await internal_sio.emit(
            "log_run",
            {
                "run_id": run_id_str,
                "operation_type": resource_type,
                "input_text_tokens": input_text_tokens,
                "output_text_tokens": output_text_tokens,
                "system_prompt": system_prompt,
                "input_items": input_items,
                "assistant_output": assistant_output,
                "department_id": department_id_str,
            },
        )
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Failed to emit log_run for text completion")


# Note: register_server_endpoint requires a type, but we handle multiple event types
# The endpoint registration is handled by the @internal_sio.on decorators above

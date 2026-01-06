"""Unified persistence helpers for artifact generation."""

import uuid
from typing import Any, cast

from app.main import IMAGE_FOLDER, VIDEO_FOLDER
from app.sql.types import (CompleteImageGenerationSqlParams,
                           CompleteImageGenerationSqlRow,
                           CreateGenerationAndLinkSqlParams,
                           CreateGenerationAndLinkSqlRow)
from utils.sql_helper import execute_sql_typed, load_sql

from .base import ImageGenerationResult, VideoGenerationResult


async def persist_image(
    conn: Any,
    image_id: uuid.UUID,
    result: ImageGenerationResult,
    image_name: str,
) -> str:
    """Unified image persistence - same for all providers.

    Args:
        conn: Database connection
        image_id: Image ID
        result: ImageGenerationResult with image_bytes, mime_type, file_size
        image_name: Name for the image file

    Returns:
        file_path: Relative file path to the saved image
    """
    import re

    # Determine file extension from mime type
    file_ext = ".png"
    if result.mime_type == "image/jpeg" or result.mime_type == "image/jpg":
        file_ext = ".jpg"
    elif result.mime_type == "image/gif":
        file_ext = ".gif"

    # Create deduplicated filename from image name
    safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", image_name)
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    safe_name = safe_name.lower() or "image"

    # Append UUID for deduplication
    upload_uuid = uuid.uuid4()
    file_name = f"{safe_name}_{upload_uuid}{file_ext}"
    file_path = f"image/{file_name}"
    full_path = IMAGE_FOLDER / file_name

    # Ensure image directory exists
    IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)

    # Save image bytes to file
    with open(full_path, "wb") as f:
        f.write(result.image_bytes)

    # Persist to database using SQL function
    params = CompleteImageGenerationSqlParams(
        image_id=image_id,
        file_path=file_path,
        mime_type=result.mime_type,
        file_size=result.file_size,
    )
    sql_result = cast(
        CompleteImageGenerationSqlRow,
        await execute_sql_typed(
            conn,
            "app/sql/v4/images/complete_image_generation_complete.sql",
            params=params,
        ),
    )

    return file_path


async def persist_video(
    conn: Any,
    video_id: uuid.UUID,
    result: VideoGenerationResult,
    run_id: uuid.UUID,
) -> str:
    """Unified video persistence - same for all providers.

    Args:
        conn: Database connection
        video_id: Video ID
        result: VideoGenerationResult with video_bytes, mime_type, file_size, upload_id
        run_id: Run ID

    Returns:
        file_path: Relative file path to the saved video
    """
    # Determine file extension from mime type
    file_ext = ".mp4"
    if result.mime_type == "video/webm":
        file_ext = ".webm"

    # Create filename
    video_filename = f"{video_id}_{uuid.uuid4()}{file_ext}"
    video_relative_path = f"video/{video_filename}"
    VIDEO_FOLDER.mkdir(parents=True, exist_ok=True)
    video_path = VIDEO_FOLDER / video_filename

    # Save video bytes to file
    video_path.write_bytes(result.video_bytes)

    # Persist to database using SQL function
    params = CreateGenerationAndLinkSqlParams(
        video_id=video_id,
        file_path=video_relative_path,
        mime_type=result.mime_type,
        upload_id=result.upload_id,
        active=True,
        run_id=run_id,
    )
    sql_result = cast(
        CreateGenerationAndLinkSqlRow,
        await execute_sql_typed(
            conn,
            "app/sql/v4/videos/create_generation_and_link_complete.sql",
            params=params,
        ),
    )

    return video_relative_path


async def persist_tool_call(
    conn: Any,
    run_id: uuid.UUID,
    call_id: str,
    tool_name: str,
    tool_type: str,
    arguments_json: dict[str, Any],
    arguments_raw: str,
    result_content: str | None = None,
    result_json: dict[str, Any] | None = None,
) -> uuid.UUID:
    """Unified tool call persistence - creates tool_call, arguments, results, links to run.

    Args:
        conn: Database connection
        run_id: Run ID
        call_id: Call ID (from provider)
        tool_name: Tool name
        tool_type: Tool type
        arguments_json: Tool call arguments as JSON
        arguments_raw: Tool call arguments as raw string
        result_content: Tool call result content (optional)
        result_json: Tool call result as JSON (optional)

    Returns:
        tool_call_id: UUID of the created tool call
    """
    # Tool calls are persisted via progress update SQL functions
    # This is a simplified version - actual implementation uses text_tool_progress_update_complete.sql
    # For now, return a placeholder - actual implementation will be in tool_call adapters
    raise NotImplementedError(
        "Tool call persistence is handled by tool_call adapters via progress update SQL functions"
    )


async def persist_audio_message(
    conn: Any,
    message_id: uuid.UUID,
    upload_id: uuid.UUID,
) -> None:
    """Unified audio message persistence - links upload_id to message_id via message_audio table.

    Args:
        conn: Database connection
        message_id: Message ID
        upload_id: Upload ID (audio file)
    """
    # Audio linking is handled inline in voice_progress_upsert_complete.sql and member_progress_upsert_complete.sql
    # This is a helper that can be used directly if needed
    sql_query = """
        INSERT INTO message_audio (message_id, upload_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (message_id, upload_id) DO UPDATE SET updated_at = NOW()
    """
    await conn.execute(sql_query, str(message_id), str(upload_id))


async def persist_user_audio(
    conn: Any,
    chat_id: uuid.UUID,
    run_id: uuid.UUID,
    content: str,
    upload_id: uuid.UUID | None = None,
    audio: bool = True,
) -> uuid.UUID:
    """Unified user audio persistence - creates message, links audio upload, persists transcript.

    Args:
        conn: Database connection
        chat_id: Chat ID
        run_id: Run ID
        content: Message content (transcript)
        upload_id: Upload ID (audio file, optional)
        audio: Whether this is an audio message

    Returns:
        message_id: UUID of the created message
    """
    # User audio is persisted via member_progress_upsert_complete.sql
    # This is a simplified version - actual implementation uses that SQL function
    # For now, return a placeholder - actual implementation will be in audio adapters
    raise NotImplementedError(
        "User audio persistence is handled by audio adapters via member_progress_upsert_complete.sql"
    )


async def persist_assistant_audio(
    conn: Any,
    run_id: uuid.UUID,
    content: str,
    upload_id: uuid.UUID | None = None,
    tool_call_id: uuid.UUID | None = None,
    parent_message_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Unified assistant audio persistence - creates message, links audio upload, persists tool call results.

    Args:
        conn: Database connection
        run_id: Run ID
        content: Message content
        upload_id: Upload ID (audio file, optional)
        tool_call_id: Tool call ID (optional)
        parent_message_id: Parent message ID for branching (optional)

    Returns:
        message_id: UUID of the created message
    """
    # Assistant audio is persisted via voice_progress_upsert_complete.sql
    # This is a simplified version - actual implementation uses that SQL function
    # For now, return a placeholder - actual implementation will be in audio adapters
    raise NotImplementedError(
        "Assistant audio persistence is handled by audio adapters via voice_progress_upsert_complete.sql"
    )


"""Handler for video_regenerate WebSocket event."""

import asyncio
import uuid
from typing import Any, Literal, cast

from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel, ValidationError
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import VIDEO_FOLDER, get_internal_sio, sio

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        GetVideoRegenerationRunContextAndCreateRunSqlParams,
        GetVideoRegenerationRunContextAndCreateRunSqlRow,
    )
except ImportError:
    from pydantic import BaseModel

    class GetVideoRegenerationRunContextAndCreateRunSqlParams(BaseModel):
        video_id: uuid.UUID
        profile_id: uuid.UUID | None = None
        group_id: uuid.UUID
        user_instructions: str | None = None

    class GetVideoRegenerationRunContextAndCreateRunSqlRow(BaseModel):
        agent_id: str
        agent_name: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider: str
        base_url: str
        api_key: str
        custom_model: str | None
        provider_id: str | None
        provider_name: str
        profile_id: str | None
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        department_id: uuid.UUID | None
        run_id: str
        group_id: uuid.UUID
        previous_messages: list[Any] | None = None


internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/videos/get_video_regeneration_run_context_and_create_run_complete.sql"
)


# Pydantic models for server-to-client events
class VideoRegenerationProgressPayload(BaseModel):
    """Response indicating progress in video regeneration."""

    type: str
    message: str | None = None
    status: str | None = None
    progress: float | None = None
    video_id: str | None = None


class VideoRegenerationCompletePayload(BaseModel):
    """Response indicating video regeneration completed successfully."""

    success: bool
    message: str
    videoUrl: str | None = None
    videoId: str | None = None


class VideoRegenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in video regeneration."""

    success: bool
    message: str
    video_id: str | None = None


# Pydantic model for client-to-server event
class RegenerateVideoPayload(BaseModel):
    """Request to regenerate a video."""

    videoId: str
    prompt: str
    groupId: str  # REQUIRED for regeneration
    imageReferenceId: str | None = None
    userInstructions: str | None = None


# Emit helper functions
async def video_regeneration_progress(
    payload: VideoRegenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "videos_regeneration_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def video_regeneration_complete(
    payload: VideoRegenerationCompletePayload, room: str
) -> None:
    await sio.emit("videos_regeneration_complete", payload.model_dump(), room=room)


async def video_regeneration_error(
    payload: VideoRegenerationErrorPayload, room: str
) -> None:
    await sio.emit("videos_regeneration_error", payload.model_dump(), room=room)


async def _video_regenerate_impl(sid: str, data: RegenerateVideoPayload) -> None:
    """Handle video regeneration requests via WebSocket."""
    try:
        video_id = uuid.UUID(data.videoId)
        group_id = uuid.UUID(data.groupId)  # REQUIRED for regeneration

        # Get profile_id from sid lookup (O(1) Redis lookup)
        profile_id_str = await find_profile_by_socket(sid)
        profile_id = uuid.UUID(profile_id_str) if profile_id_str else None

        async with get_db_connection() as conn:
            # Emit start event
            await video_regeneration_progress(
                VideoRegenerationProgressPayload(
                    type="start",
                    message="Starting video regeneration",
                    status="created",
                    video_id=str(video_id),
                ),
                room=sid,
            )

            # Get agent context AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                params = GetVideoRegenerationRunContextAndCreateRunSqlParams(
                    video_id=video_id,
                    profile_id=profile_id,
                    group_id=group_id,  # REQUIRED for regeneration (uses existing group)
                    user_instructions=data.userInstructions,
                )
                result = cast(
                    GetVideoRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await video_regeneration_error(
                        VideoRegenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            video_id=str(video_id),
                        ),
                        room=sid,
                    )
                    return
                await video_regeneration_error(
                    VideoRegenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize video regeneration: {str(e)}",
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            if not result:
                await video_regeneration_error(
                    VideoRegenerationErrorPayload(
                        success=False,
                        message=(
                            f"No video agent configured for video {data.videoId}. "
                            "Please configure a video agent in system settings."
                        ),
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)
            department_id = result.department_id

            if not result.api_key:
                agent_name = result.agent_name or "video agent"
                model_name = result.model_name or "unknown model"
                await video_regeneration_error(
                    VideoRegenerationErrorPayload(
                        success=False,
                        message=(
                            f"API key not found for {agent_name} (model: {model_name}). "
                            "Please link an API key to the model in system settings."
                        ),
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            # Extract context data
            encrypted_api_key = result.api_key
            model_name = result.model_name

            # Decrypt the API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except ValueError as e:
                await video_regeneration_error(
                    VideoRegenerationErrorPayload(
                        success=False,
                        message=(
                            f"Failed to decrypt API key for {result.agent_name or 'video agent'}: {str(e)}"
                        ),
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            # Build prompt: original prompt + user instructions
            final_prompt = data.prompt
            if data.userInstructions and data.userInstructions.strip():
                final_prompt = f"{data.prompt}\n\nUser Instructions: {data.userInstructions.strip()}"

            # Hardcoded values per plan (same as generate.py)
            seconds: Literal["4", "8", "12"] = "4"
            model: Literal["sora-2", "sora-2-pro"] = "sora-2"
            size: Literal["720x1280", "1280x720", "1024x1792", "1792x1024"] = "720x1280"

            # Initialize OpenAI client
            client = OpenAI(api_key=api_key)

            # Create video job (same logic as generate.py)
            create_params: dict[str, Any] = {
                "prompt": final_prompt,
                "model": model,
                "seconds": seconds,
                "size": size,
            }
            if data.imageReferenceId:
                create_params["image_reference_id"] = data.imageReferenceId

            video_job = await asyncio.to_thread(client.videos.create, **create_params)

            video_job_id = video_job.id
            # Poll for completion with progress updates (same logic as generate.py)
            max_polls = 60
            poll_count = 0
            while poll_count < max_polls:
                video_status = await asyncio.to_thread(
                    client.videos.retrieve, video_job_id
                )
                progress_value = (
                    video_status.progress / 100.0
                    if video_status.progress is not None
                    else None
                )
                await video_regeneration_progress(
                    VideoRegenerationProgressPayload(
                        type="polling",
                        message=f"Video regeneration in progress: {video_status.status}",
                        status=video_status.status,
                        progress=progress_value,
                        video_id=str(video_id),
                    ),
                    room=sid,
                )

                if video_status.status == "completed":
                    # Download video (same logic as generate.py)
                    video_response = await asyncio.to_thread(
                        client.videos.download_content, video_job_id
                    )
                    video_content_bytes: bytes = getattr(video_response, "content", b"")
                    if not video_content_bytes:
                        if hasattr(video_response, "read"):
                            video_content_bytes = video_response.read()  # type: ignore[attr-defined]

                    if not video_content_bytes:
                        await video_regeneration_error(
                            VideoRegenerationErrorPayload(
                                success=False,
                                message="Video regeneration returned empty content",
                                video_id=str(video_id),
                            ),
                            room=sid,
                        )
                        return

                    video_filename = f"{video_id}_{uuid.uuid4()}.mp4"
                    video_relative_path = f"video/{video_filename}"
                    VIDEO_FOLDER.mkdir(parents=True, exist_ok=True)
                    video_path = VIDEO_FOLDER / video_filename
                    await asyncio.to_thread(video_path.write_bytes, video_content_bytes)
                    async with conn.transaction():
                        # Create upload record
                        mime_type = "video/mp4"
                        file_size = len(video_content_bytes)
                        sql_query = load_sql("app/sql/v4/uploads/insert_upload.sql")
                        upload_id_str = await conn.fetchval(
                            sql_query,
                            video_relative_path,
                            mime_type,
                            file_size,
                        )

                        if not upload_id_str:
                            await video_regeneration_error(
                                VideoRegenerationErrorPayload(
                                    success=False,
                                    message="Failed to create upload record",
                                    video_id=str(video_id),
                                ),
                                room=sid,
                            )
                            return
                        # Create generation and link to video
                        sql_create_generation = load_sql(
                            "app/sql/v4/videos/create_generation_and_link.sql"
                        )
                        generation_result = await conn.fetchrow(
                            sql_create_generation,
                            str(video_id),
                            video_relative_path,
                            mime_type,
                            uuid.UUID(upload_id_str),
                            True,
                            str(model_run_id),
                        )

                    # Emit async pricing event (non-blocking)
                    await internal_sio.emit(
                        "log_run",
                        {
                            "run_id": str(model_run_id),
                            "operation_type": "video_regeneration",
                            "input_text_tokens": 0,
                            "output_text_tokens": 0,
                            "system_prompt": result.system_prompt or "",
                            "input_items": [{"role": "user", "content": final_prompt}],
                            "assistant_output": f"Video regenerated: {video_filename}",
                            "department_id": str(department_id)
                            if department_id
                            else None,
                        },
                    )

                    # Emit completion event
                    await video_regeneration_complete(
                        VideoRegenerationCompletePayload(
                            success=True,
                            message="Video regenerated successfully",
                            videoUrl=f"/api/uploads/download/{upload_id_str}",
                            videoId=str(video_id),
                        ),
                        room=sid,
                    )
                    return

                elif video_status.status == "failed":
                    await video_regeneration_error(
                        VideoRegenerationErrorPayload(
                            success=False,
                            message=f"Video regeneration failed: {video_status.status}",
                            video_id=str(video_id),
                        ),
                        room=sid,
                    )
                    return

                # Wait before next poll
                await asyncio.sleep(5)
                poll_count += 1

            # Timeout
            await video_regeneration_error(
                VideoRegenerationErrorPayload(
                    success=False,
                    message="Video regeneration timed out",
                    video_id=str(video_id),
                ),
                room=sid,
            )

    except Exception as e:
        video_id_str = str(data.videoId) if hasattr(data, "videoId") else None
        await video_regeneration_error(
            VideoRegenerationErrorPayload(
                success=False, message=str(e), video_id=video_id_str
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def video_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = RegenerateVideoPayload(**data)
        await _video_regenerate_impl(sid, validated)
    except ValidationError as e:
        await video_regeneration_error(
            VideoRegenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", video_id=None
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/regenerate", response_model=dict[str, bool])
async def video_regenerate_api(request: RegenerateVideoPayload) -> dict[str, bool]:
    """Client-to-server event: Regenerate a video using AI."""
    return {"success": True}

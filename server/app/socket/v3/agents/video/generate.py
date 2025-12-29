"""Handler for video_generate WebSocket event."""

import asyncio
import uuid
from typing import Any, Literal

from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel, ValidationError
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import VIDEO_FOLDER, get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class VideoGenerationProgressPayload(BaseModel):
    """Response indicating progress in video generation."""

    type: str  # "start", "polling", "completed"
    message: str | None = None
    status: str | None = None  # "created", "processing", "completed", "failed"
    progress: float | None = None  # 0.0 to 1.0
    video_id: str | None = None


class VideoGenerationCompletePayload(BaseModel):
    """Response indicating video generation completed successfully."""

    success: bool
    message: str
    videoUrl: str | None = None
    videoId: str | None = None


class VideoGenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in video generation."""

    success: bool
    message: str
    video_id: str | None = None


# Pydantic model for client-to-server event
class GenerateVideoPayload(BaseModel):
    """Request to generate a video."""

    videoId: str
    prompt: str
    imageReferenceId: str | None = None


# Emit helper functions
async def video_generation_progress(
    payload: VideoGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "videos_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def video_generation_complete(
    payload: VideoGenerationCompletePayload, room: str
) -> None:
    await sio.emit("videos_generation_complete", payload.model_dump(), room=room)


async def video_generation_error(
    payload: VideoGenerationErrorPayload, room: str
) -> None:
    await sio.emit("videos_generation_error", payload.model_dump(), room=room)


async def _video_generate_impl(sid: str, data: GenerateVideoPayload) -> None:
    """Handle video generation requests via WebSocket."""
    try:
        logger.info(f"Received video_generate request from {sid} with data: {data}")

        video_id = uuid.UUID(data.videoId)

        # Get connection pool
        pool = get_pool()
        if not pool:
            await video_generation_error(
                VideoGenerationErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    video_id=str(video_id),
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Emit start event
            await video_generation_progress(
                VideoGenerationProgressPayload(
                    type="start",
                    message="Starting video generation",
                    status="created",
                    video_id=str(video_id),
                ),
                room=sid,
            )

            # Get agent context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            # Note: Video generation doesn't have profile_id in payload, so we use None (defaults to guest)
            sql_query = load_sql(
                "app/sql/v3/videos/get_video_run_context_and_create_run.sql"
            )
            try:
                context_row = await conn.fetchrow(sql_query, str(video_id), None)
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await video_generation_error(
                        VideoGenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            video_id=str(video_id),
                        ),
                        room=sid,
                    )
                    return
                # Log other errors
                logger.error(
                    f"Failed to get context and create run for {sid}: {str(e)}",
                    exc_info=True,
                )
                await video_generation_error(
                    VideoGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize video generation: {str(e)}",
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            if not context_row:
                await video_generation_error(
                    VideoGenerationErrorPayload(
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
            model_run_id = uuid.UUID(context_row["run_id"])
            department_id = context_row.get("department_id")

            if not context_row.get("api_key"):
                agent_name = context_row.get("agent_name", "video agent")
                model_name = context_row.get("model_name", "unknown model")
                await video_generation_error(
                    VideoGenerationErrorPayload(
                        success=False,
                        message=(
                            f"API key not found for {agent_name} (model: {model_name}). "
                            "Please link an API key to the model in system settings. "
                            "For OpenAI video generation, ensure the model is linked to an OpenAI API key."
                        ),
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            # Extract context data
            encrypted_api_key = context_row["api_key"]
            model_name = context_row["model_name"]
            logger.info(
                f"Using video agent: {context_row['agent_name']}, model: {model_name}"
            )

            # Decrypt the API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except ValueError as e:
                await video_generation_error(
                    VideoGenerationErrorPayload(
                        success=False,
                        message=(
                            f"Failed to decrypt API key for {context_row.get('agent_name', 'video agent')}: {str(e)}"
                        ),
                        video_id=str(video_id),
                    ),
                    room=sid,
                )
                return

            # Hardcoded values per plan
            seconds: Literal["4", "8", "12"] = "4"
            model: Literal["sora-2", "sora-2-pro"] = "sora-2"
            size: Literal["720x1280", "1280x720", "1024x1792", "1792x1024"] = "720x1280"

            # Initialize OpenAI client
            client = OpenAI(api_key=api_key)

            # Create video job
            create_params: dict[str, Any] = {
                "prompt": data.prompt,
                "model": model,
                "seconds": seconds,
                "size": size,
            }
            if data.imageReferenceId:
                create_params["image_reference_id"] = data.imageReferenceId

            video_job = await asyncio.to_thread(client.videos.create, **create_params)

            video_job_id = video_job.id
            logger.info(
                f"Created video job: {video_job_id}, status: {video_job.status}"
            )

            # Poll for completion with progress updates
            max_polls = 60  # 5 minutes max (5 second intervals)
            poll_count = 0
            while poll_count < max_polls:
                video_status = await asyncio.to_thread(
                    client.videos.retrieve, video_job_id
                )
                logger.info(
                    f"Video job {video_job_id} status: {video_status.status}, progress: {video_status.progress}"
                )

                # Emit progress update
                progress_value = (
                    video_status.progress / 100.0
                    if video_status.progress is not None
                    else None
                )
                await video_generation_progress(
                    VideoGenerationProgressPayload(
                        type="polling",
                        message=f"Video generation in progress: {video_status.status}",
                        status=video_status.status,
                        progress=progress_value,
                        video_id=str(video_id),
                    ),
                    room=sid,
                )

                if video_status.status == "completed":
                    # Download video
                    video_response = await asyncio.to_thread(
                        client.videos.download_content, video_job_id
                    )
                    video_content_bytes: bytes = getattr(video_response, "content", b"")
                    if not video_content_bytes:
                        if hasattr(video_response, "read"):
                            video_content_bytes = video_response.read()  # type: ignore[attr-defined]

                    if not video_content_bytes:
                        await video_generation_error(
                            VideoGenerationErrorPayload(
                                success=False,
                                message="Video generation returned empty content",
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

                    logger.info(f"Video saved to: {video_path}")

                    async with conn.transaction():
                        # Create upload record
                        mime_type = "video/mp4"
                        file_size = len(video_content_bytes)
                        sql_query = load_sql("app/sql/v3/uploads/insert_upload.sql")
                        upload_id_str = await conn.fetchval(
                            sql_query,
                            video_relative_path,
                            mime_type,
                            file_size,
                        )

                        if not upload_id_str:
                            await video_generation_error(
                                VideoGenerationErrorPayload(
                                    success=False,
                                    message="Failed to create upload record",
                                    video_id=str(video_id),
                                ),
                                room=sid,
                            )
                            return

                        logger.info(
                            f"Created upload record: {upload_id_str}, file_path: {video_relative_path}"
                        )

                        # Create generation and link to video (with run_id from SQL)
                        sql_create_generation = load_sql(
                            "app/sql/v3/videos/create_generation_and_link.sql"
                        )
                        generation_result = await conn.fetchrow(
                            sql_create_generation,
                            str(video_id),
                            video_relative_path,
                            mime_type,
                            uuid.UUID(upload_id_str),
                            True,  # active
                            str(model_run_id),  # run_id - now created in SQL
                        )

                    # Emit async pricing event (non-blocking)
                    # Video generation doesn't use LLM tokens, so we set tokens to 0
                    # This handles message logging in background via internal bus
                    await internal_sio.emit(
                        "log_run",
                        {
                            "runId": str(model_run_id),
                            "operationType": "video",
                            "inputTextTokens": 0,  # Video generation doesn't use LLM tokens
                            "outputTextTokens": 0,  # Video generation doesn't use LLM tokens
                            "systemPrompt": context_row.get("system_prompt", ""),
                            "inputItems": [
                                {"role": "user", "content": data.prompt}
                            ],  # Simple prompt input
                            "assistantOutput": f"Video generated: {video_filename}",
                            "departmentId": str(department_id)
                            if department_id
                            else None,
                        },
                    )

                    if generation_result:
                        generation_id = generation_result["generation_id"]
                        logger.info(
                            f"Created generation {generation_id} and linked to video {video_id}"
                        )
                    else:
                        logger.warning(
                            f"Failed to create generation for video {video_id}"
                        )

                    # Emit completion event
                    await video_generation_complete(
                        VideoGenerationCompletePayload(
                            success=True,
                            message="Video generated successfully",
                            videoUrl=f"/api/uploads/download/{upload_id_str}",
                            videoId=str(video_id),
                        ),
                        room=sid,
                    )
                    # Log activity
                    try:
                        await log_websocket_activity(
                            sid=sid,
                            event_key="videos.generated",
                            template="{{ actor.name }} generated video",
                            context={"video_id": str(video_id)},
                            endpoint="/socket/v3/videos/generate",
                            error=False,
                        )
                    except Exception as log_error:
                        logger.warning(
                            f"Error logging video generation activity: {log_error}"
                        )
                    return

                elif video_status.status == "failed":
                    await video_generation_error(
                        VideoGenerationErrorPayload(
                            success=False,
                            message=f"Video generation failed: {video_status.status}",
                            video_id=str(video_id),
                        ),
                        room=sid,
                    )
                    return

                # Wait before next poll
                await asyncio.sleep(5)
                poll_count += 1

            # Timeout
            await video_generation_error(
                VideoGenerationErrorPayload(
                    success=False,
                    message="Video generation timed out",
                    video_id=str(video_id),
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error in video_generate for {sid}: {str(e)}", exc_info=True)
        video_id_str = str(data.videoId) if hasattr(data, "videoId") else None
        await video_generation_error(
            VideoGenerationErrorPayload(
                success=False, message=str(e), video_id=video_id_str
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def video_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateVideoPayload(**data)
        await _video_generate_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in video_generate for {sid}: {e}")
        await video_generation_error(
            VideoGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", video_id=None
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def video_generate_api(request: GenerateVideoPayload) -> dict[str, bool]:
    """Client-to-server event: Generate a video using AI."""
    return {"success": True}


@server_router.post("/generation_progress", response_model=dict[str, bool])
async def video_generation_progress_api(
    request: VideoGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Progress update for video generation."""
    return {"success": True}


@server_router.post("/generation_complete", response_model=dict[str, bool])
async def video_generation_complete_api(
    request: VideoGenerationCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Video generation completed successfully."""
    return {"success": True}


@server_router.post("/generation_error", response_model=dict[str, bool])
async def video_generation_error_api(
    request: VideoGenerationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred during video generation."""
    return {"success": True}

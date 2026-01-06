"""OpenAI video generation adapter - handles video generation using Sora API."""

import asyncio
import uuid
from typing import Any, Literal, cast

import asyncpg  # type: ignore
from openai import OpenAI

from app.main import get_internal_sio
from app.sql.types import (
    GetVideoRunContextAndCreateRunSqlParams,
    GetVideoRunContextAndCreateRunSqlRow,
)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed

from ..base import VideoGenerationResult
from .base import BaseVideoAdapter

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/videos/get_video_run_context_and_create_run_complete.sql"


class OpenAIVideoAdapter(BaseVideoAdapter):
    """OpenAI video generation adapter."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> VideoGenerationResult:
        """Generate video - returns unified result type.

        Args:
            sid: Socket ID
            data: Request data containing videoId, prompt, imageReferenceId
            profile_id: Profile ID (optional)
            conn: Database connection

        Returns:
            VideoGenerationResult with video_bytes, mime_type, file_size, upload_id
        """
        try:
            video_id = uuid.UUID(data.get("videoId", ""))
            prompt = data.get("prompt", "")
            image_reference_id = data.get("imageReferenceId")

            # Emit start event
            await internal_sio.emit(
                "generate_video_progress",
                {
                    "sid": sid,
                    "type": "start",
                    "message": "Starting video generation",
                    "status": "created",
                    "progress": None,
                    "video_id": str(video_id),
                },
            )

            # Get agent context AND create run in single atomic transaction
            try:
                params = GetVideoRunContextAndCreateRunSqlParams(
                    video_id=video_id,
                    profile_id=profile_id,
                )
                result = cast(
                    GetVideoRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                error_msg = str(e)
                # Check if it's a rate limit error from SQL
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await internal_sio.emit(
                        "generate_video_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                            "video_id": str(video_id),
                        },
                    )
                    raise ValueError(user_msg)
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize video generation: {str(e)}",
                        "video_id": str(video_id),
                    },
                )
                raise

            if not result:
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": (
                            f"No video agent configured for video {data.get('videoId')}. "
                            "Please configure a video agent in system settings."
                        ),
                        "video_id": str(video_id),
                    },
                )
                raise ValueError(
                    f"No video agent configured for video {data.get('videoId')}"
                )

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)
            department_id = result.department_id

            if not result.api_key:
                agent_name = result.agent_name or "video agent"
                model_name = result.model_name or "unknown model"
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": (
                            f"API key not found for {agent_name} (model: {model_name}). "
                            "Please link an API key to the model in system settings."
                        ),
                        "video_id": str(video_id),
                    },
                )
                raise ValueError(f"API key not found for {agent_name}")

            # Extract context data
            encrypted_api_key = result.api_key
            model_name = result.model_name
            provider = result.provider

            # Decrypt the API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except ValueError as e:
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": (
                            f"Failed to decrypt API key for {result.agent_name or 'video agent'}: {str(e)}"
                        ),
                        "video_id": str(video_id),
                    },
                )
                raise

            # Provider-specific video generation logic
            if provider == "openai" and model_name and model_name.startswith("sora"):
                # OpenAI Sora API
                client = OpenAI(api_key=api_key)

                # Hardcoded values per existing pattern
                seconds: Literal["4", "8", "12"] = "4"
                model: Literal["sora-2", "sora-2-pro"] = "sora-2"
                size: Literal["720x1280", "1280x720", "1024x1792", "1792x1024"] = "720x1280"

                # Create video job
                create_params: dict[str, Any] = {
                    "prompt": prompt,
                    "model": model,
                    "seconds": seconds,
                    "size": size,
                }
                if image_reference_id:
                    create_params["image_reference_id"] = image_reference_id

                video_job = await asyncio.to_thread(client.videos.create, **create_params)

                video_job_id = video_job.id
                # Poll for completion with progress updates
                max_polls = 60  # 5 minutes max (5 second intervals)
                poll_count = 0
                while poll_count < max_polls:
                    video_status = await asyncio.to_thread(
                        client.videos.retrieve, video_job_id
                    )
                    # Emit progress update via internal bus
                    progress_value = (
                        video_status.progress / 100.0
                        if video_status.progress is not None
                        else None
                    )
                    await internal_sio.emit(
                        "generate_video_progress",
                        {
                            "sid": sid,
                            "type": "polling",
                            "message": f"Video generation in progress: {video_status.status}",
                            "status": video_status.status,
                            "progress": progress_value,
                            "video_id": str(video_id),
                        },
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
                            await internal_sio.emit(
                                "generate_video_error",
                                {
                                    "sid": sid,
                                    "success": False,
                                    "message": "Video generation returned empty content",
                                    "video_id": str(video_id),
                                },
                            )
                            raise ValueError("Video generation returned empty content")

                        # Create upload record first to get upload_id
                        from utils.sql_helper import load_sql

                        mime_type = "video/mp4"
                        file_size = len(video_content_bytes)
                        sql_query = load_sql("app/sql/v4/uploads/insert_upload_complete.sql")
                        from app.sql.types import InsertUploadSqlParams

                        upload_params = InsertUploadSqlParams(
                            file_path="",  # Will be set during persistence
                            mime_type=mime_type,
                            size=file_size,
                        )
                        from app.sql.types import InsertUploadSqlRow

                        upload_result = cast(
                            InsertUploadSqlRow,
                            await execute_sql_typed(conn, sql_query, params=upload_params),
                        )

                        if not upload_result or not upload_result.id:
                            await internal_sio.emit(
                                "generate_video_error",
                                {
                                    "sid": sid,
                                    "success": False,
                                    "message": "Failed to create upload record",
                                    "video_id": str(video_id),
                                },
                            )
                            raise ValueError("Failed to create upload record")

                        upload_id = uuid.UUID(upload_result.id)

                        # Return unified result type
                        return VideoGenerationResult(
                            video_bytes=video_content_bytes,
                            mime_type=mime_type,
                            file_size=file_size,
                            upload_id=upload_id,
                        )

                    elif video_status.status == "failed":
                        await internal_sio.emit(
                            "generate_video_error",
                            {
                                "sid": sid,
                                "success": False,
                                "message": f"Video generation failed: {video_status.status}",
                                "video_id": str(video_id),
                            },
                        )
                        raise ValueError(f"Video generation failed: {video_status.status}")

                    # Wait before next poll
                    await asyncio.sleep(5)
                    poll_count += 1

                # Timeout
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Video generation timed out",
                        "video_id": str(video_id),
                    },
                )
                raise ValueError("Video generation timed out")
            else:
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Provider {provider} not yet supported",
                        "video_id": str(video_id),
                    },
                )
                raise ValueError(f"Provider {provider} not yet supported")

        except Exception as e:
            await internal_sio.emit(
                "generate_video_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": f"Unexpected error: {str(e)}",
                    "video_id": str(data.get("videoId", "")),
                },
            )
            raise


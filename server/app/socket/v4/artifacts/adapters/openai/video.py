"""OpenAI video generation adapter - handles video generation using Sora API."""

import asyncio
import uuid
from typing import Any, Literal, cast

import asyncpg  # type: ignore
from openai import OpenAI

from app.main import VIDEO_FOLDER, get_internal_sio
from app.sql.types import (
    GetVideoRunContextAndCreateRunSqlParams,
    GetVideoRunContextAndCreateRunSqlRow,
)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/videos/get_video_run_context_and_create_run_complete.sql"


class OpenAIVideoAdapter:
    """OpenAI video generation adapter."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> None:
        """Generate video using OpenAI Sora API.

        Args:
            sid: Socket ID
            data: Request data containing videoId, prompt, imageReferenceId
            profile_id: Profile ID (optional)
            conn: Database connection
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
                    return
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize video generation: {str(e)}",
                        "video_id": str(video_id),
                    },
                )
                return

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
                return

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
                return

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
                return

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
                                await internal_sio.emit(
                                    "generate_video_error",
                                    {
                                        "sid": sid,
                                        "success": False,
                                        "message": "Failed to create upload record",
                                        "video_id": str(video_id),
                                    },
                                )
                                return
                            # Create generation and link to video (with run_id from SQL)
                            sql_create_generation = load_sql(
                                "app/sql/v4/videos/create_generation_and_link.sql"
                            )
                            await conn.fetchrow(
                                sql_create_generation,
                                str(video_id),
                                video_relative_path,
                                mime_type,
                                uuid.UUID(upload_id_str),
                                True,  # active
                                str(model_run_id),  # run_id - now created in SQL
                            )

                        # Emit async pricing event (non-blocking)
                        await internal_sio.emit(
                            "log_run",
                            {
                                "run_id": str(model_run_id),
                                "operation_type": "video",
                                "input_text_tokens": 0,
                                "output_text_tokens": 0,
                                "system_prompt": result.system_prompt or "",
                                "input_items": [
                                    {"role": "user", "content": prompt}
                                ],
                                "assistant_output": f"Video generated: {video_filename}",
                                "department_id": str(department_id)
                                if department_id
                                else None,
                            },
                        )

                        # Emit completion event to internal bus
                        await internal_sio.emit(
                            "generate_video_complete",
                            {
                                "sid": sid,
                                "success": True,
                                "message": "Video generated successfully",
                                "videoUrl": f"/api/uploads/download/{upload_id_str}",
                                "videoId": str(video_id),
                            },
                        )
                        return

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
                        return

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
            else:
                await internal_sio.emit(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Provider {provider} not yet supported for video generation",
                        "video_id": str(video_id),
                    },
                )

        except Exception as e:
            video_id_str = str(data.get("videoId", "")) if data.get("videoId") else None
            await internal_sio.emit(
                "generate_video_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": str(e),
                    "video_id": video_id_str,
                },
            )


"""OpenAI video generation adapter - handles video generation using Sora API."""

import asyncio
from typing import Any, Literal

from openai import OpenAI

from ....base.config import AdapterConfig, AdapterEventCallbacks
from ....base.output_adapter import BaseOutputAdapter
from ....base.types import VideoGenerationResult


class OpenAIVideoAdapter(BaseOutputAdapter):
    """OpenAI video generation adapter."""

    async def generate_output(
        self,
        sid: str,
        config: AdapterConfig,
        callbacks: AdapterEventCallbacks,
    ) -> VideoGenerationResult:
        """Generate video - returns unified result type.

        Args:
            sid: Socket ID
            config: AdapterConfig with all necessary data (no database access)
            callbacks: Event callbacks for progress, completion, and error events

        Returns:
            VideoGenerationResult with video_bytes, mime_type, file_size, upload_id
            Note: upload_id should be created by caller (generate.py) before calling this
        """
        video_id = config.video_id
        if not video_id:
            raise ValueError("video_id is required")

        prompt = config.prompt or ""
        image_reference_id = config.image_reference_id

        try:
            # Emit start event
            await callbacks.emit_progress(
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

            # Provider-specific video generation logic
            if config.provider == "openai" and config.model_name and config.model_name.startswith("sora"):
                # OpenAI Sora API
                client = OpenAI(api_key=config.api_key)  # Already decrypted

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
                    # Emit progress update via callback
                    progress_value = (
                        video_status.progress / 100.0
                        if video_status.progress is not None
                        else None
                    )
                    await callbacks.emit_progress(
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
                            await callbacks.emit_error(
                                "generate_video_error",
                                {
                                    "sid": sid,
                                    "success": False,
                                    "message": "Video generation returned empty content",
                                    "video_id": str(video_id),
                                },
                            )
                            raise ValueError("Video generation returned empty content")

                        mime_type = "video/mp4"
                        file_size = len(video_content_bytes)

                        # Note: upload_id should be created by caller (generate.py) before calling this adapter
                        if config.upload_id is None:
                            raise ValueError("upload_id must be created before calling video adapter")

                        # Return unified result type
                        return VideoGenerationResult(
                            video_bytes=video_content_bytes,
                            mime_type=mime_type,
                            file_size=file_size,
                            upload_id=config.upload_id,
                        )

                    elif video_status.status == "failed":
                        await callbacks.emit_error(
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
                await callbacks.emit_error(
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
                await callbacks.emit_error(
                    "generate_video_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Provider {config.provider} not yet supported",
                        "video_id": str(video_id),
                    },
                )
                raise ValueError(f"Provider {config.provider} not yet supported")

        except Exception as e:
            await callbacks.emit_error(
                "generate_video_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": f"Unexpected error: {str(e)}",
                    "video_id": str(video_id),
                },
            )
            raise

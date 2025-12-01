"""Video generate endpoint - v3 API following DHH principles.

Generates video using Sora2 API (OpenAI).
For now, returns a hardcoded video path with commented Sora2 implementation.
"""

import os
import uuid
from pathlib import Path
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import BASE_FOLDER, UPLOAD_FOLDER, get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

logger = get_logger(__name__)

# TODO: Uncomment when ready to use full Sora2 API
# from openai import OpenAI

router = APIRouter()


class GenerateVideoRequest(BaseModel):
    """Request to generate video."""

    videoId: str
    prompt: str
    imageReferenceId: str | None = None


class GenerateVideoResponse(BaseModel):
    """Response from video generation."""

    success: bool
    message: str
    videoUrl: str | None = None
    videoId: str | None = None


@router.post("/generate-video", response_model=GenerateVideoResponse)
async def generate_video(
    request: GenerateVideoRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateVideoResponse:
    """Generate video using Sora2 API (hardcoded 4 seconds).
    
    For now, returns a hardcoded video path. Full Sora2 implementation is commented out.
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        video_id = uuid.UUID(request.videoId)

        # Hardcoded values per plan
        seconds = "4"
        model = "sora-2"
        size = "720x1280"

        # TODO: Uncomment when ready to use full Sora2 API
        # # Get OpenAI API key from database
        # sql_get_key = load_sql("sql/v3/keys/get_openai_api_key.sql")
        # key_row = await conn.fetchrow(sql_get_key)
        # 
        # if not key_row or not key_row.get("api_key"):
        #     raise ValueError("OpenAI API key not found. Please configure API key in system settings.")
        # 
        # api_key = key_row["api_key"]
        # 
        # # Initialize OpenAI client
        # client = OpenAI(api_key=api_key)
        # 
        # # Create video job
        # video_job = client.videos.create(
        #     prompt=request.prompt,
        #     model=model,
        #     seconds=seconds,
        #     size=size,
        #     input_reference=request.imageReferenceId if request.imageReferenceId else None,
        # )
        # 
        # video_job_id = video_job.id
        # logger.info(f"Created video job: {video_job_id}, status: {video_job.status}")
        # 
        # # Poll for completion
        # max_polls = 60  # 5 minutes max (5 second intervals)
        # poll_count = 0
        # while poll_count < max_polls:
        #     video_status = client.videos.retrieve(video_job_id)
        #     logger.info(f"Video job {video_job_id} status: {video_status.status}, progress: {video_status.progress}")
        # 
        #     if video_status.status == "completed":
        #         # Download video
        #         video_url = video_status.video_url
        #         if not video_url:
        #             raise ValueError("Video completed but no URL provided")
        # 
        #         # Download and save to uploads folder
        #         import httpx
        #         async with httpx.AsyncClient() as client_http:
        #             response = await client_http.get(video_url)
        #             response.raise_for_status()
        # 
        #         video_filename = f"{video_id}_{uuid.uuid4()}.mp4"
        #         video_path = UPLOAD_FOLDER / video_filename
        #         video_path.write_bytes(response.content)
        # 
        #         logger.info(f"Video saved to: {video_path}")
        # 
        #         # Update video record with file path
        #         sql_update_video = load_sql("sql/v3/videos/update_video_file_path.sql")
        #         await conn.execute(
        #             sql_update_video,
        #             str(video_id),
        #             str(video_path.relative_to(BASE_FOLDER)),
        #         )
        # 
        #         return GenerateVideoResponse(
        #             success=True,
        #             message="Video generated successfully",
        #             videoUrl=f"/uploads/{video_filename}",
        #             videoId=str(video_id),
        #         )
        #     elif video_status.status == "failed":
        #         raise ValueError(f"Video generation failed: {video_status.status}")
        # 
        #     # Wait before next poll
        #     import asyncio
        #     await asyncio.sleep(5)
        #     poll_count += 1
        # 
        # raise ValueError("Video generation timed out")

        # For now, return hardcoded video path
        # Check if uploads folder has any video files
        video_files = list(UPLOAD_FOLDER.glob("*.mp4"))
        if video_files:
            # Use the first video file found
            video_file = video_files[0]
            video_filename = video_file.name
            logger.info(f"Using hardcoded video: {video_filename}")
            
            # Save file_path and mime_type to database
            # Store just the filename (relative to UPLOAD_FOLDER), consistent with images
            video_path_relative = video_filename
            mime_type = "video/mp4"
            
            sql_query = load_sql("sql/v3/videos/update_video_file_path.sql")
            sql_params = (str(video_id), video_path_relative, mime_type)
            await conn.execute(sql_query, *sql_params)
            
            logger.info(f"Saved video file_path: {video_path_relative}, mime_type: {mime_type}")
            
            # Return URL using download endpoint instead of direct /uploads/ path
            return GenerateVideoResponse(
                success=True,
                message="Video generation completed (using hardcoded video)",
                videoUrl=f"/api/videos/download/{video_id}",
                videoId=str(video_id),
            )
        else:
            # No video files found, return placeholder
            logger.warning("No video files found in uploads folder, returning placeholder")
            return GenerateVideoResponse(
                success=True,
                message="Video generation completed (placeholder - no video files found)",
                videoUrl=None,
                videoId=str(video_id),
            )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_video",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise


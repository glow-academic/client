"""Video generate endpoint - v3 API following DHH principles.

Generates video using Sora2 API (OpenAI).
"""

import asyncio
import uuid
from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.main import UPLOAD_FOLDER, get_db
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from openai import OpenAI
from pydantic import BaseModel

logger = get_logger(__name__)

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
    """Generate video using Sora2 API (4 seconds).
    
    Creates a video generation job, polls for completion, downloads the video,
    saves it to the uploads folder, and updates the database with file_path and mime_type.
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        video_id = uuid.UUID(request.videoId)

        # Get agent context with API key, model, and other settings from database
        # Uses video's department to find the appropriate video agent
        sql_query = load_sql("sql/v3/agents/get_video_run_context.sql")
        sql_params = (str(video_id), None)  # profile_id is None, SQL will use default guest
        context_row = await conn.fetchrow(sql_query, str(video_id), None)
        
        if not context_row:
            raise ValueError(
                f"No video agent configured for video {request.videoId}. Please configure a video agent in system settings."
            )
        
        if not context_row.get("api_key"):
            agent_name = context_row.get("agent_name", "video agent")
            model_name = context_row.get("model_name", "unknown model")
            raise ValueError(
                f"API key not found for {agent_name} (model: {model_name}). "
                f"Please link an API key to the model in system settings. "
                f"For OpenAI video generation, ensure the model is linked to an OpenAI API key."
            )
        
        # Extract context data
        encrypted_api_key = context_row["api_key"]
        model_name = context_row["model_name"]
        logger.info(f"Using video agent: {context_row['agent_name']}, model: {model_name}")
        
        # Decrypt the API key (keys are stored encrypted in the database)
        try:
            api_key = decrypt_api_key(encrypted_api_key)
        except ValueError as e:
            raise ValueError(
                f"Failed to decrypt API key for {context_row.get('agent_name', 'video agent')}: {str(e)}"
            ) from e
        
        # Hardcoded values per plan - using Literal types for type safety
        # Note: These are OpenAI Videos API specific settings, not the agent's model
        seconds: Literal["4", "8", "12"] = "4"
        model: Literal["sora-2", "sora-2-pro"] = "sora-2"
        size: Literal["720x1280", "1280x720", "1024x1792", "1792x1024"] = "720x1280"
        
        # Initialize OpenAI client with decrypted API key from agent's model
        client = OpenAI(api_key=api_key)
        
        # Create video job
        # Note: input_reference is only used if imageReferenceId is provided and is a file path/bytes
        # For now, we'll omit it if not provided since it expects FileTypes (file-like object)
        create_params: dict[str, Any] = {
            "prompt": request.prompt,
            "model": model,
            "seconds": seconds,
            "size": size,
        }
        # Only add input_reference if provided (would need to be converted to file-like object)
        # For now, skipping input_reference as it requires file handling
        
        video_job = client.videos.create(**create_params)
        
        video_job_id = video_job.id
        logger.info(f"Created video job: {video_job_id}, status: {video_job.status}")
        
        # Poll for completion
        max_polls = 60  # 5 minutes max (5 second intervals)
        poll_count = 0
        while poll_count < max_polls:
            video_status = client.videos.retrieve(video_job_id)
            logger.info(f"Video job {video_job_id} status: {video_status.status}, progress: {video_status.progress}")
            
            if video_status.status == "completed":
                # Download video using the download_content method
                video_response = client.videos.download_content(video_job_id)
                # download_content returns HttpxBinaryResponseContent which has .content attribute with bytes
                # Read the content - it's bytes-like at runtime
                video_content_bytes: bytes = getattr(video_response, 'content', b'')
                if not video_content_bytes:
                    # Fallback: try reading if content is empty
                    if hasattr(video_response, 'read'):
                        video_content_bytes = video_response.read()  # type: ignore[attr-defined]
                
                video_filename = f"{video_id}_{uuid.uuid4()}.mp4"
                video_path = UPLOAD_FOLDER / video_filename
                video_path.write_bytes(video_content_bytes)
                
                logger.info(f"Video saved to: {video_path}")
                
                # Update video record with file path
                # Store just the filename (relative to UPLOAD_FOLDER), consistent with images
                mime_type = "video/mp4"
                sql_query = load_sql("sql/v3/videos/update_video_file_path.sql")
                sql_params = (str(video_id), video_filename, mime_type)
                await conn.execute(sql_query, *sql_params)
                
                logger.info(f"Saved video file_path: {video_filename}, mime_type: {mime_type}")
                
                # Return URL using download endpoint instead of direct /uploads/ path
                return GenerateVideoResponse(
                    success=True,
                    message="Video generated successfully",
                    videoUrl=f"/api/videos/download/{video_id}",
                    videoId=str(video_id),
                )
            elif video_status.status == "failed":
                raise ValueError(f"Video generation failed: {video_status.status}")
            
            # Wait before next poll
            await asyncio.sleep(5)
            poll_count += 1
        
        raise ValueError("Video generation timed out")

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


"""Document upload init endpoint - v3 API following DHH principles."""

import json
import os
import uuid
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.extensions import UPLOAD_FOLDER
from app.utils.http_cache import invalidate_tags
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(UPLOAD_FOLDER, "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)


# Inline request/response schemas
class UploadInitRequest(BaseModel):
    """Request to initialize document upload."""

    filename: str
    contentType: str
    uploadLength: int


class UploadInitResponse(BaseModel):
    """Response from upload init."""

    success: bool
    uploadId: str
    location: str
    message: str


router = APIRouter()


@router.post("/upload/init", response_model=UploadInitResponse)
async def upload_init(
    request: UploadInitRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadInitResponse:
    """Initialize a document upload."""
    tags = ["documents"]  # From router tags
    
    try:
        # Generate upload ID
        upload_id = str(uuid.uuid4())
        upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)
        os.makedirs(upload_dir, exist_ok=True)

        # Create metadata
        metadata = {
            "filename": request.filename,
            "filetype": request.contentType,
        }

        # Save metadata
        with open(os.path.join(upload_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f)

        # Create empty file
        with open(os.path.join(upload_dir, "file"), "wb") as f:
            pass

        # Save upload info
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write(f"length:{request.uploadLength}\noffset:0")

        # Get app prefix from environment
        app_prefix = os.getenv("APP_PREFIX", "").strip("/")
        
        # Generate location path
        if app_prefix:
            location_v3 = f"/{app_prefix}/api/v3/documents/upload/{upload_id}"
        else:
            location_v3 = f"/api/v3/documents/upload/{upload_id}"
        
        result_data = UploadInitResponse(
            success=True,
            uploadId=upload_id,
            location=location_v3,
            message="Upload initialized successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


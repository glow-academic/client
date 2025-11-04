"""Document upload init endpoint - v3 API following DHH principles."""

import base64
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.document_service import DocumentService
from app.utils.http_cache import invalidate_tags
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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
        service = DocumentService(conn)
        
        # Get app prefix from environment
        import os
        app_prefix = os.getenv("APP_PREFIX", "").strip("/")
        
        # Create metadata
        metadata = {
            "filename": request.filename,
            "filetype": request.contentType,
        }
        
        # Create TUS upload
        upload_id, location, offset = await service.create_tus_upload(
            str(request.uploadLength), metadata, app_prefix
        )
        
        # Update location to v3 endpoint
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


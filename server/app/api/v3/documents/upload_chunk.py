"""Document upload chunk endpoint - v3 API following DHH principles."""

import base64
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.document_service import DocumentService
from app.utils.http_cache import invalidate_tags
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class UploadChunkRequest(BaseModel):
    """Request to upload a chunk."""

    uploadId: str
    chunk: str  # Base64 encoded chunk data
    offset: int  # Current offset position


class UploadChunkResponse(BaseModel):
    """Response from upload chunk."""

    success: bool
    offset: int
    message: str


router = APIRouter()


@router.post("/upload/chunk", response_model=UploadChunkResponse)
async def upload_chunk(
    request: UploadChunkRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadChunkResponse:
    """Upload a chunk of data."""
    tags = ["documents"]  # From router tags
    
    try:
        service = DocumentService(conn)
        
        # Decode base64 chunk
        try:
            chunk_data = base64.b64decode(request.chunk)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 chunk data: {str(e)}")
        
        # Append chunk
        success, new_offset, error = service.append_tus_chunk(
            request.uploadId, chunk_data, str(request.offset)
        )
        
        if not success:
            if error == "Upload not found":
                raise HTTPException(status_code=404, detail="Upload not found")
            elif error == "Offset mismatch":
                raise HTTPException(status_code=409, detail="Offset mismatch")
            else:
                raise HTTPException(status_code=500, detail=error or "Failed to write chunk")
        
        result_data = UploadChunkResponse(
            success=True,
            offset=new_offset or request.offset,
            message="Chunk uploaded successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


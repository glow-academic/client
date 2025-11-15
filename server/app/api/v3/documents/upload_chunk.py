"""Document upload chunk endpoint - v3 API following DHH principles."""

import base64
import os
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import UPLOAD_FOLDER, get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(UPLOAD_FOLDER, "tus_uploads")


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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadChunkResponse:
    """Upload a chunk of data."""
    tags = ["documents"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        upload_dir = os.path.join(TUS_UPLOADS_DIR, request.uploadId)

        if not os.path.exists(upload_dir):
            raise HTTPException(status_code=404, detail="Upload not found")

        # Read info file
        info = {}
        with open(os.path.join(upload_dir, "info")) as f:
            for line in f:
                k, v = line.strip().split(":", 1)
                info[k] = v

        # Check offset
        if str(request.offset) != info.get("offset"):
            raise HTTPException(status_code=409, detail="Offset mismatch")

        # Decode base64 chunk
        try:
            chunk_data = base64.b64decode(request.chunk)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid base64 chunk data: {str(e)}"
            ) from e

        # Append to file
        with open(os.path.join(upload_dir, "file"), "ab") as f:
            f.write(chunk_data)

        # Update offset
        new_offset = int(info.get("offset", "0")) + len(chunk_data)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

        result_data = UploadChunkResponse(
            success=True,
            offset=new_offset,
            message="Chunk uploaded successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="upload_chunk",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

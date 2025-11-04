"""Document upload finalize endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.document_service import DocumentService
from app.utils.http_cache import invalidate_tags
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class UploadFinalizeRequest(BaseModel):
    """Request to finalize upload."""

    uploadId: str
    fileId: str
    zip: bool | None = False
    autoClassify: bool | None = False
    csv: bool | None = False
    test: bool | None = False
    profileId: str | None = None
    departmentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None


class UploadFinalizeResponse(BaseModel):
    """Response from finalize upload."""

    success: bool
    message: str
    status: str
    documentId: str | None = None
    documents: list[dict] | None = None
    usersCreated: int | None = None
    usersSkipped: int | None = None
    errors: list[str] | None = None


router = APIRouter()


@router.post("/upload/finalize", response_model=UploadFinalizeResponse)
async def upload_finalize(
    request: UploadFinalizeRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadFinalizeResponse:
    """Finalize a document upload and process the file."""
    tags = ["documents"]  # From router tags
    
    try:
        service = DocumentService(conn)
        
        # Convert v3 request to v2 schema format
        from app.schemas.documents import FinalizeUploadRequest
        
        finalize_request = FinalizeUploadRequest(
            fileId=request.fileId,
            zip=request.zip,
            autoClassify=request.autoClassify,
            csv=request.csv,
            test=request.test,
            profile_id=request.profileId,
            department_ids=request.departmentIds,
            parameter_item_ids=request.parameterItemIds,
        )
        
        # Finalize upload
        result = await service.finalize_tus_upload(finalize_request)
        
        # Convert v2 response to v3 format
        result_data = UploadFinalizeResponse(
            success=result.success,
            message=result.message,
            status=result.status,
            documentId=result.document_id,
            documents=result.documents,
            usersCreated=result.users_created,
            usersSkipped=result.users_skipped,
            errors=result.errors,
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


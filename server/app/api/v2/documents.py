"""Documents API endpoints."""

import base64
import os
import urllib.parse
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response

from app.db import get_db
from app.schemas.documents import (
    BulkDeleteDocumentsRequest,
    BulkUpdateDocumentsRequest,
    DeleteDocumentRequest,
    DeleteDocumentResponse,
    DocumentDetailBulkRequest,
    DocumentDetailBulkResponse,
    DocumentDetailRequest,
    DocumentDetailResponse,
    DocumentsFilters,
    DocumentsListResponse,
    FinalizeUploadRequest,
    FinalizeUploadResponse,
    GenerateCertificateRequest,
    UpdateDocumentRequest,
    UpdateDocumentResponse,
)
from app.services.document_service import DocumentService, get_document_service

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/list", response_model=DocumentsListResponse)
async def get_documents_list(
    filters: DocumentsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentsListResponse:
    """Get documents list with tags and scenarios."""
    try:
        service = get_document_service(conn)
        return await service.get_documents_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=DocumentDetailResponse)
async def get_document_detail(
    request: DocumentDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentDetailResponse:
    """Get detailed document information."""
    try:
        service = get_document_service(conn)
        return await service.get_document_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-bulk", response_model=DocumentDetailBulkResponse)
async def get_document_detail_bulk(
    request: DocumentDetailBulkRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentDetailBulkResponse:
    """Get bulk document detail information."""
    try:
        service = get_document_service(conn)
        return await service.get_document_detail_bulk(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateDocumentResponse)
async def update_document(
    request: UpdateDocumentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDocumentResponse:
    """Update a document."""
    try:
        service = get_document_service(conn)
        return await service.update_document(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-update", response_model=UpdateDocumentResponse)
async def bulk_update_documents(
    request: BulkUpdateDocumentsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDocumentResponse:
    """Bulk update documents."""
    try:
        service = get_document_service(conn)
        return await service.bulk_update_documents(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteDocumentResponse)
async def delete_document(
    request: DeleteDocumentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDocumentResponse:
    """Delete a document."""
    try:
        service = get_document_service(conn)
        return await service.delete_document(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=DeleteDocumentResponse)
async def bulk_delete_documents(
    request: BulkDeleteDocumentsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDocumentResponse:
    """Bulk delete documents."""
    try:
        service = get_document_service(conn)
        return await service.bulk_delete_documents(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TUS UPLOAD ENDPOINTS
# ============================================================================


@router.options("/upload")
async def tus_options(request: Request) -> Response:
    """Handle OPTIONS request for tus protocol discovery."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Tus-Max-Size": "1073741824",  # 1GB max file size
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post("/upload")
async def tus_creation(
    request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Handle POST request for tus protocol - create upload."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Get upload length
    upload_length = request.headers.get("Upload-Length")
    if not upload_length:
        return Response(status_code=400, content="Missing Upload-Length header")

    # Parse metadata
    metadata = {}
    if "Upload-Metadata" in request.headers:
        for kv in request.headers["Upload-Metadata"].split(","):
            if " " in kv:
                k, v = kv.strip().split(" ", 1)
                metadata[k] = base64.b64decode(v).decode("utf-8")

    # Get app prefix from environment
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")

    # Create upload using service
    service = DocumentService(conn)
    upload_id, location, offset = await service.create_tus_upload(
        upload_length, metadata, app_prefix
    )

    # Handle creation-with-upload if Content-Length > 0
    if request.headers.get("Content-Length", "0") != "0":
        chunk = await request.body()
        success, new_offset, error = service.append_tus_chunk(
            upload_id, chunk, str(offset)
        )

        if not success:
            return Response(status_code=500, content=error or "Failed to write chunk")

        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(new_offset),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            },
        )

    return Response(
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        },
    )


@router.head("/upload/{upload_id}")
async def tus_head(
    upload_id: str,
    request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Handle HEAD request for tus protocol - get upload info."""
    service = DocumentService(conn)
    info = await service.get_tus_upload_info(upload_id)

    if not info:
        return Response(status_code=404)

    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": info.get("offset", "0"),
        "Upload-Length": info.get("length", "0"),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
    }

    return Response(headers=headers)


@router.patch("/upload/{upload_id}")
async def tus_patch(
    upload_id: str,
    request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Handle PATCH request for tus protocol - upload chunk."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Check content type
    if request.headers.get("Content-Type") != "application/offset+octet-stream":
        return Response(status_code=415)

    # Get expected offset
    expected_offset = request.headers.get("Upload-Offset")
    if not expected_offset:
        return Response(status_code=400, content="Missing Upload-Offset header")

    # Read chunk
    chunk = await request.body()

    # Append chunk using service
    service = DocumentService(conn)
    success, new_offset, error = service.append_tus_chunk(
        upload_id, chunk, expected_offset
    )

    if not success:
        if error == "Upload not found":
            return Response(status_code=404)
        elif error == "Offset mismatch":
            return Response(status_code=409)
        else:
            return Response(status_code=500, content=error or "Failed to write chunk")

    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )


@router.options("/upload/{upload_id}")
async def tus_options_upload_id(upload_id: str, request: Request) -> Response:
    """Handle OPTIONS request for specific upload."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post("/upload/finalize", response_model=FinalizeUploadResponse)
async def finalize_upload(
    request: FinalizeUploadRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FinalizeUploadResponse:
    """Finalize an upload and process the file."""
    service = DocumentService(conn)
    return await service.finalize_tus_upload(request)


# ============================================================================
# DOWNLOAD ENDPOINTS
# ============================================================================


@router.get("/download/{document_id}")
async def download_document(
    document_id: str,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FileResponse:
    """Download a document by ID."""
    service = DocumentService(conn)
    result = await service.get_document_file(document_id)

    if not result:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path, filename, content_type = result

    # Properly encode filename for HTTP headers
    encoded_filename = urllib.parse.quote(filename, safe="")
    content_disposition = (
        f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
    )

    return FileResponse(
        path=file_path,
        media_type=content_type,
        headers={
            "Content-Disposition": content_disposition,
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    )

# ============================================================================
# CERTIFICATE GENERATION
# ============================================================================


@router.post("/certificate")
async def generate_certificate(
    request: GenerateCertificateRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Generate a certificate PDF/text for a profile."""
    try:
        service = DocumentService(conn)
        file_content, content_type, headers = service.generate_certificate(request)

        return Response(
            content=file_content,
            media_type=content_type,
            headers=headers,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate certificate: {str(e)}"
        )

"""Documents API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.document_repository import get_document_repository
from app.schemas.documents import (BulkDeleteDocumentsRequest,
                                   BulkUpdateDocumentsRequest,
                                   DeleteDocumentRequest,
                                   DeleteDocumentResponse,
                                   DocumentDetailBulkRequest,
                                   DocumentDetailBulkResponse,
                                   DocumentDetailRequest,
                                   DocumentDetailResponse, DocumentsFilters,
                                   DocumentsListResponse,
                                   UpdateDocumentRequest,
                                   UpdateDocumentResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/list", response_model=DocumentsListResponse)
async def get_documents_list(
    filters: DocumentsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> DocumentsListResponse:
    """Get documents list with tags and scenarios."""
    try:
        repo = get_document_repository(db)
        return repo.get_documents_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=DocumentDetailResponse)
async def get_document_detail(
    request: DocumentDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DocumentDetailResponse:
    """Get detailed document information."""
    try:
        repo = get_document_repository(db)
        return repo.get_document_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-bulk", response_model=DocumentDetailBulkResponse)
async def get_document_detail_bulk(
    request: DocumentDetailBulkRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DocumentDetailBulkResponse:
    """Get bulk document detail information."""
    try:
        repo = get_document_repository(db)
        return repo.get_document_detail_bulk(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateDocumentResponse)
async def update_document(
    request: UpdateDocumentRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateDocumentResponse:
    """Update a document."""
    try:
        repo = get_document_repository(db)
        return repo.update_document(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-update", response_model=UpdateDocumentResponse)
async def bulk_update_documents(
    request: BulkUpdateDocumentsRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateDocumentResponse:
    """Bulk update documents."""
    try:
        repo = get_document_repository(db)
        return repo.bulk_update_documents(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteDocumentResponse)
async def delete_document(
    request: DeleteDocumentRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteDocumentResponse:
    """Delete a document."""
    try:
        repo = get_document_repository(db)
        return repo.delete_document(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=DeleteDocumentResponse)
async def bulk_delete_documents(
    request: BulkDeleteDocumentsRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteDocumentResponse:
    """Bulk delete documents."""
    try:
        repo = get_document_repository(db)
        return repo.bulk_delete_documents(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


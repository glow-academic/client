"""Document repository for database operations.

This repository delegates to the document service layer.
"""

from typing import Optional

from app.db import get_session
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
from app.services.document_service import DocumentService
from sqlalchemy.orm import Session


class DocumentRepository:
    """
    Repository for document operations.
    
    This repository delegates to the document service layer.
    """

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.db = db
        self.service = DocumentService(db)

    def get_documents_list(
        self, filters: DocumentsFilters
    ) -> DocumentsListResponse:
        """Get documents list."""
        return self.service.get_documents_list(filters)

    def get_document_detail(
        self, request: DocumentDetailRequest
    ) -> DocumentDetailResponse:
        """Get document detail."""
        return self.service.get_document_detail(request)

    def get_document_detail_bulk(
        self, request: DocumentDetailBulkRequest
    ) -> DocumentDetailBulkResponse:
        """Get bulk document detail."""
        return self.service.get_document_detail_bulk(request)

    def update_document(
        self, request: UpdateDocumentRequest
    ) -> UpdateDocumentResponse:
        """Update document."""
        return self.service.update_document(request)

    def bulk_update_documents(
        self, request: BulkUpdateDocumentsRequest
    ) -> UpdateDocumentResponse:
        """Bulk update documents."""
        return self.service.bulk_update_documents(request)

    def delete_document(
        self, request: DeleteDocumentRequest
    ) -> DeleteDocumentResponse:
        """Delete document."""
        return self.service.delete_document(request)

    def bulk_delete_documents(
        self, request: BulkDeleteDocumentsRequest
    ) -> DeleteDocumentResponse:
        """Bulk delete documents."""
        return self.service.bulk_delete_documents(request)


def get_document_repository(db: Optional[Session] = None) -> DocumentRepository:
    """Get document repository instance."""
    if db is None:
        db = next(get_session())
    return DocumentRepository(db)


"""Document repository for database operations.

This repository delegates to the document service layer.
"""

import asyncpg  # type: ignore
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


class DocumentRepository:
    """
    Repository for document operations.
    
    This repository delegates to the document service layer.
    """

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = DocumentService(conn)

    async def get_documents_list(
        self, filters: DocumentsFilters
    ) -> DocumentsListResponse:
        """Get documents list."""
        return await self.service.get_documents_list(filters)

    async def get_document_detail(
        self, request: DocumentDetailRequest
    ) -> DocumentDetailResponse:
        """Get document detail."""
        return await self.service.get_document_detail(request)

    async def get_document_detail_bulk(
        self, request: DocumentDetailBulkRequest
    ) -> DocumentDetailBulkResponse:
        """Get bulk document detail."""
        return await self.service.get_document_detail_bulk(request)

    async def update_document(
        self, request: UpdateDocumentRequest
    ) -> UpdateDocumentResponse:
        """Update document."""
        return await self.service.update_document(request)

    async def bulk_update_documents(
        self, request: BulkUpdateDocumentsRequest
    ) -> UpdateDocumentResponse:
        """Bulk update documents."""
        return await self.service.bulk_update_documents(request)

    async def delete_document(
        self, request: DeleteDocumentRequest
    ) -> DeleteDocumentResponse:
        """Delete document."""
        return await self.service.delete_document(request)

    async def bulk_delete_documents(
        self, request: BulkDeleteDocumentsRequest
    ) -> DeleteDocumentResponse:
        """Bulk delete documents."""
        return await self.service.bulk_delete_documents(request)


def get_document_repository(conn: asyncpg.Connection) -> DocumentRepository:
    """Get document repository instance."""
    return DocumentRepository(conn)

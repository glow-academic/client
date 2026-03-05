"""Document artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetDocumentsResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
    # Junction IDs — None when not requested
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    files_ids: list[UUID] | None = None
    images_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    texts_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None


class CreateDocumentResponse(BaseModel):
    id: UUID


class UpdateDocumentResponse(BaseModel):
    id: UUID

"""Document drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateDocumentDraftResponse(BaseModel):
    id: UUID


class GetDocumentDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    department_ids: list[UUID]
    description_ids: list[UUID]
    file_ids: list[UUID]
    flag_ids: list[UUID]
    image_ids: list[UUID]
    name_ids: list[UUID]
    parameter_field_ids: list[UUID]
    parameter_ids: list[UUID]
    profile_ids: list[UUID]
    text_ids: list[UUID]

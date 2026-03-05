"""Field artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetFieldsResponse(BaseModel):
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
    conditional_parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None


class CreateFieldResponse(BaseModel):
    id: UUID


class UpdateFieldResponse(BaseModel):
    id: UUID

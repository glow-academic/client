"""Parameter artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetParametersResponse(BaseModel):
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
    field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


class CreateParameterResponse(BaseModel):
    id: UUID


class UpdateParameterResponse(BaseModel):
    id: UUID


class DeleteParametersResponse(BaseModel):
    deleted_ids: list[UUID]

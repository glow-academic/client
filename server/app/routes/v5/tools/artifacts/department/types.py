"""Department artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetDepartmentsResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
    # Junction IDs — None when not requested
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    settings_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None


class CreateDepartmentResponse(BaseModel):
    id: UUID


class UpdateDepartmentResponse(BaseModel):
    id: UUID

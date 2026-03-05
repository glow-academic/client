"""Rubric artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetRubricsResponse(BaseModel):
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
    point_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None


class CreateRubricResponse(BaseModel):
    id: UUID


class UpdateRubricResponse(BaseModel):
    id: UUID


class DeleteRubricsResponse(BaseModel):
    deleted_ids: list[UUID]

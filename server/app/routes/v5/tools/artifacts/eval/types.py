"""Eval artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetEvalsResponse(BaseModel):
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
    model_ids: list[UUID] | None = None
    model_flag_ids: list[UUID] | None = None
    model_position_ids: list[UUID] | None = None
    model_rubric_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    eval_ids: list[UUID] | None = None


class CreateEvalResponse(BaseModel):
    id: UUID


class UpdateEvalResponse(BaseModel):
    id: UUID

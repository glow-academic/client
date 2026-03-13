"""Invocation drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateInvocationDraftResponse(BaseModel):
    id: UUID


class GetInvocationDraftResponse(BaseModel):
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
    flag_ids: list[UUID]
    key_ids: list[UUID]
    model_flag_ids: list[UUID]
    model_position_ids: list[UUID]
    model_rubric_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    temperature_level_ids: list[UUID]
    voice_ids: list[UUID]
    value_ids: list[UUID]
    pricing_ids: list[UUID]
    endpoint_ids: list[UUID]

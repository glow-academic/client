"""Cohort drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateCohortDraftResponse(BaseModel):
    id: UUID


class GetCohortDraftResponse(BaseModel):
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
    name_ids: list[UUID]
    profile_persona_ids: list[UUID]
    profile_ids: list[UUID]
    simulation_availability_ids: list[UUID]
    simulation_position_ids: list[UUID]
    simulation_ids: list[UUID]

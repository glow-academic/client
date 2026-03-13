"""Simulation drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateSimulationDraftResponse(BaseModel):
    id: UUID


class GetSimulationDraftResponse(BaseModel):
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
    profile_ids: list[UUID]
    scenario_flag_ids: list[UUID]
    scenario_position_ids: list[UUID]
    scenario_rubric_ids: list[UUID]
    scenario_time_limit_ids: list[UUID]
    scenario_ids: list[UUID]

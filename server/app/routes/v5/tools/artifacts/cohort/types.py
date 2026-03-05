"""Cohort artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetCohortsResponse(BaseModel):
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
    profiles_ids: list[UUID] | None = None
    profile_persona_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    simulation_availability_ids: list[UUID] | None = None
    simulation_position_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None

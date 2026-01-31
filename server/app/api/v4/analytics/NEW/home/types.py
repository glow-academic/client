"""Custom types for NEW home endpoints.

These types define the client-facing API contract, separate from the
auto-generated SQL parameter types. The key difference is that internal
parameters (mode, accessible_cohort_ids) are NOT included here - they
are injected by Python from the context query.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class GetHomeHistoryNewClientRequest(BaseModel):
    """Client API request for home history.

    Note: mode and accessible_cohort_ids are NOT included here - they are
    internal parameters injected by the Python backend from the context query.
    """

    start_date: str
    end_date: str
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    roles: Any | None = None
    simulation_filters: list[str] | None = Field(default_factory=list)  # type: ignore[arg-type]
    search: str | None = None
    profile_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    scenario_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    infinite_mode: bool | None = None
    sort_by: str | None = None
    sort_order: str | None = None
    page: int | None = 0
    page_size: int | None = 20

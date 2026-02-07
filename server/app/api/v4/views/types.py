"""Shared types for view endpoints.

These types are used across all view endpoints for consistent filtering and responses.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ViewFilterArgs(BaseModel):
    """Shared filter args for all views.

    Used to filter view data by practice mode, archived status, profile, etc.
    These filters are applied at query time on the MVs.
    """

    practice: bool | None = Field(
        default=None,
        description="Filter by practice mode. None=all, True=practice, False=non-practice (home)",
    )
    archived: bool | None = Field(
        default=False,
        description="Filter by archived status. None=all, True=archived, False=active",
    )
    profile_id: UUID | None = Field(
        default=None,
        description="Filter by profile ID",
    )
    simulation_ids: list[UUID] | None = Field(
        default=None,
        description="Filter by simulation IDs",
    )
    cohort_ids: list[UUID] | None = Field(
        default=None,
        description="Filter by cohort IDs",
    )
    department_ids: list[UUID] | None = Field(
        default=None,
        description="Filter by department IDs",
    )
    date_from: datetime | None = Field(
        default=None,
        description="Filter by date range start (inclusive)",
    )
    date_to: datetime | None = Field(
        default=None,
        description="Filter by date range end (inclusive)",
    )


class PaginationArgs(BaseModel):
    """Pagination arguments for list endpoints."""

    page_limit: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Number of items per page",
    )
    page_offset: int = Field(
        default=0,
        ge=0,
        description="Offset for pagination",
    )


class RefreshResponse(BaseModel):
    """Response for refresh/recreate operations."""

    success: bool = Field(description="Whether the operation succeeded")
    method: Literal["concurrent", "recreate"] = Field(description="Refresh method used")
    message: str | None = Field(default=None, description="Additional message")
    duration_ms: int | None = Field(
        default=None, description="Duration of the operation in milliseconds"
    )

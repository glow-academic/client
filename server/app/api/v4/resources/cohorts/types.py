"""Canonical cohorts resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class CohortsResourceData(BaseModel):
    """Canonical cohorts resource fields. All optional for streaming support."""

    cohort_id: str | None = None
    title: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None

"""Shared types for analytics artifact endpoints."""

from pydantic import BaseModel, Field


class FilterOption(BaseModel):
    """A single filter option for dropdown selectors."""

    value: str
    label: str | None = None
    count: int | None = None


class AnalyticsFilterOptions(BaseModel):
    """Filter options returned by analytics endpoints for populating UI dropdowns."""

    earliest_date: str | None = None
    simulation_options: list[FilterOption] = Field(default_factory=list)
    scenario_options: list[FilterOption] = Field(default_factory=list)
    profile_options: list[FilterOption] = Field(default_factory=list)


class BaseAnalyticsRequest(BaseModel):
    """Common request fields shared across analytics endpoints."""

    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[str] = Field(default_factory=list)
    department_ids: list[str] = Field(default_factory=list)
    simulation_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    simulation_filters: list[str] = Field(default_factory=list)
    actor_profile_id: str | None = None
    target_profile_id: str | None = None

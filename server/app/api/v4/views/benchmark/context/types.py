"""Types for benchmark context view."""

from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkContextViewItem(BaseModel):
    """IDs-first benchmark item -- raw IDs only, no computed fields."""

    benchmark_id: UUID
    eval_ids: list[UUID] | None = None
    suite_entry_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    run_rubric_ids: list[UUID] | None = None
    group_rubric_ids: list[UUID] | None = None
    run_position_ids: list[UUID] | None = None
    group_position_ids: list[UUID] | None = None
    use_groups: bool = False
    dynamic: bool = False


class GetBenchmarkContextViewResponse(BaseModel):
    """View-layer response for benchmark context."""

    items: list[BenchmarkContextViewItem] = Field(default_factory=list)

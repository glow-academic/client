"""Canonical run_positions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RunPositionsResourceData(BaseModel):
    """Canonical run_positions resource fields. All optional for streaming support."""

    id: str | None = None
    runs_id: str | None = None
    eval_id: str | None = None
    value: int | None = None
    generated: bool | None = None

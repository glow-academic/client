"""Canonical run_rubrics resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RunRubricsResourceData(BaseModel):
    """Canonical run_rubrics resource fields. All optional for streaming support."""

    id: str | None = None
    runs_id: str | None = None
    rubric_id: str | None = None
    generated: bool | None = None

"""Canonical arg_positions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ArgPositionsResourceData(BaseModel):
    """Canonical arg_positions resource fields. All optional for streaming support."""

    id: str | None = None
    args_id: str | None = None
    value: int | None = None
    generated: bool | None = None

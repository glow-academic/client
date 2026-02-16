"""Canonical args_outputs resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ArgsOutputsResourceData(BaseModel):
    """Canonical args_outputs resource fields. All optional for streaming support."""

    id: str | None = None
    args_id: str | None = None
    name: str | None = None
    template: str | None = None
    generated: bool | None = None

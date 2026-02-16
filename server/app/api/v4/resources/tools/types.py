"""Canonical tools resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ToolsResourceData(BaseModel):
    """Canonical tools resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None

"""Canonical prompts resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class PromptsResourceData(BaseModel):
    """Canonical prompts resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    generated: bool | None = None

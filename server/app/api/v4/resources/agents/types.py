"""Canonical agents resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class AgentsResourceData(BaseModel):
    """Canonical agents resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    model_id: str | None = None
    temperature: float | None = None
    reasoning: str | None = None
    tool_ids: list[str] | None = None
    quality: str | None = None
    voice: str | None = None
    prompt_id: str | None = None
    instruction_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None

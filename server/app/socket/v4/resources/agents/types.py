"""Typed event models for agents resource generation."""

from typing import Any

from pydantic import BaseModel


class AgentsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: agents_generation_complete."""

    artifact_type: str
    resource_type: str = "agents"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None

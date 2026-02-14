"""Typed event models for prompts resource generation."""

from typing import Any

from pydantic import BaseModel


class PromptsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: prompts_generation_complete."""

    artifact_type: str
    resource_type: str = "prompts"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None

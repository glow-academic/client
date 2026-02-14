"""Typed event models for questions resource generation."""

from typing import Any

from pydantic import BaseModel


class QuestionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: questions_generation_complete."""

    artifact_type: str
    resource_type: str = "questions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None

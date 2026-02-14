"""Typed event models for problem_statements resource generation."""

from typing import Any

from pydantic import BaseModel


class ProblemStatementsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: problem_statements_generation_complete."""

    artifact_type: str
    resource_type: str = "problem_statements"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None

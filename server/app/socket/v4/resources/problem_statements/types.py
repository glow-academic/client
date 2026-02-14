"""Typed event models for problem_statements resource socket events."""

from typing import Any

from pydantic import BaseModel


class ProblemStatementsGenerationStartedEvent(BaseModel):
    """Server-to-client event: problem_statements_generation_started."""

    artifact_type: str
    resource_type: str = "problem_statements"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ProblemStatementsGenerationProgressEvent(BaseModel):
    """Server-to-client event: problem_statements_generation_progress."""

    artifact_type: str
    resource_type: str = "problem_statements"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ProblemStatementsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: problem_statements_generation_complete."""

    artifact_type: str
    resource_type: str = "problem_statements"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    problem_statement_id: str | None = None
    name: str | None = None
    problem_statement: str | None = None
    generated: bool | None = None


class ProblemStatementsGenerationErrorEvent(BaseModel):
    """Server-to-client event: problem_statements_generation_error."""

    artifact_type: str
    resource_type: str = "problem_statements"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None

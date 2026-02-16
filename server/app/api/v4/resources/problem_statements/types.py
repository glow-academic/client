"""Canonical problem_statements resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ProblemStatementsResourceData(BaseModel):
    """Canonical problem_statements resource fields. All optional for streaming support."""

    problem_statement_id: str | None = None
    name: str | None = None
    problem_statement: str | None = None
    generated: bool | None = None

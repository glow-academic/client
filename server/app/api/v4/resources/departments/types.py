"""Canonical departments resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class DepartmentsResourceData(BaseModel):
    """Canonical departments resource fields. All optional for streaming support."""

    department_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None

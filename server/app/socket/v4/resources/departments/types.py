"""Typed event models for departments resource generation."""

from pydantic import BaseModel


class DepartmentsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: departments_generation_complete."""

    artifact_type: str
    resource_type: str = "departments"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    department_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None

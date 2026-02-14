"""Typed event models for parameter_fields resource generation."""

from pydantic import BaseModel


class ParameterFieldsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: parameter_fields_generation_complete."""

    artifact_type: str
    resource_type: str = "parameter_fields"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    field_id: str | None = None
    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    conditional_parameter_id: str | None = None

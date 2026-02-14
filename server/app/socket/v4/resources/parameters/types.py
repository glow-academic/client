"""Typed event models for parameters resource generation."""

from pydantic import BaseModel


class ParametersGenerationCompleteEvent(BaseModel):
    """Server-to-client event: parameters_generation_complete."""

    artifact_type: str
    resource_type: str = "parameters"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None
    persona_parameter: bool | None = None
    document_parameter: bool | None = None
    scenario_parameter: bool | None = None
    video_parameter: bool | None = None
    conditional: bool | None = None
    field_ids: list[str] | None = None

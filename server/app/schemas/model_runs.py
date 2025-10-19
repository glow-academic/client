"""Model run schemas for tracking model usage and tokens."""

from typing import Literal

from pydantic import BaseModel


class CreateModelRunRequest(BaseModel):
    """Request to create a model run with junction records."""

    department_id: str
    model_id: str
    entity_id: str
    entity_type: Literal["agent", "persona"]
    profile_id: str | None = None


class CreateModelRunResponse(BaseModel):
    """Response with created model run ID."""

    model_run_id: str


class UpdateModelRunTokensRequest(BaseModel):
    """Request to update model run token counts."""

    model_run_id: str
    input_tokens: int
    output_tokens: int


class UpdateModelRunTokensResponse(BaseModel):
    """Response after updating token counts."""

    success: bool

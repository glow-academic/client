"""Model artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetModelsResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    # Junction IDs — None when not requested
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    modality_ids: list[UUID] | None = None
    pricing_ids: list[UUID] | None = None
    provider_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None


class CreateModelResponse(BaseModel):
    id: UUID


class UpdateModelResponse(BaseModel):
    id: UUID

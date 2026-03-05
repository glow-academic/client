"""Provider artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetProvidersResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
    # Junction IDs — None when not requested
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    endpoint_ids: list[UUID] | None = None
    key_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None
    provider_ids: list[UUID] | None = None


class CreateProviderResponse(BaseModel):
    id: UUID


class UpdateProviderResponse(BaseModel):
    id: UUID

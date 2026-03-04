"""Auth artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetAuthsResponse(BaseModel):
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
    item_ids: list[UUID] | None = None
    protocol_ids: list[UUID] | None = None
    slug_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None

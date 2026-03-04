"""Tool artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetToolsResponse(BaseModel):
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
    args_ids: list[UUID] | None = None
    args_outputs_ids: list[UUID] | None = None
    arg_positions_ids: list[UUID] | None = None
    artifact_ids: list[UUID] | None = None
    entry_ids: list[UUID] | None = None
    operation_ids: list[UUID] | None = None
    resource_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None

"""Types for simulation message_tree view."""

from uuid import UUID

from pydantic import BaseModel


class MessageTreeViewItem(BaseModel):
    """A single message tree view item."""

    message_id: UUID
    branch_path: list[UUID] | None = None
    depth: int | None = None


class GetMessageTreeRequest(BaseModel):
    """Request for getting message tree."""

    message_ids: list[UUID]


class GetMessageTreeResponse(BaseModel):
    """Response for getting message tree."""

    items: list[MessageTreeViewItem]

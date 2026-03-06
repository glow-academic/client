"""Messages entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateMessageResponse(BaseModel):
    id: UUID
    created_at: datetime


class GetMessageResponse(BaseModel):
    id: UUID
    run_id: UUID
    role: str
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool


class SearchMessageResponse(BaseModel):
    message_id: UUID
    run_id: UUID
    role: str
    message_created_at: datetime
    text_upload_ids: list[UUID]
    audio_upload_ids: list[UUID]
    image_upload_ids: list[UUID]
    video_upload_ids: list[UUID]
    file_upload_ids: list[UUID]
    call_upload_ids: list[UUID]

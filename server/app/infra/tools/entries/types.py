"""Tool setup infra types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateToolSetupResponse(BaseModel):
    run_id: UUID
    call_id: UUID
    message_id: UUID
    text_id: UUID
    text_upload_id: UUID
    call_upload_id: UUID
    message_upload_id: UUID

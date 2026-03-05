"""Tool setup infra types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateToolSetupResponse(BaseModel):
    run_id: UUID
    call_id: UUID | None
    message_id: UUID
    text_id: UUID
    text_upload_junction_id: UUID
    call_upload_junction_id: UUID | None
    message_text_upload_junction_id: UUID
    message_call_upload_junction_id: UUID | None

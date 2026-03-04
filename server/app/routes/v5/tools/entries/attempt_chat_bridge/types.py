"""Attempt chat bridge entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateAttemptChatBridgeResponse(BaseModel):
    attempt_id: UUID
    attempt_chat_id: UUID

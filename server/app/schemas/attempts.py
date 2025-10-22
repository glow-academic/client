"""Attempts schemas for v2 API."""

from pydantic import BaseModel


class BulkArchiveAttemptsRequest(BaseModel):
    """Request to bulk archive or unarchive simulation attempts."""

    attemptIds: list[str]
    archived: bool


class BulkArchiveAttemptsResponse(BaseModel):
    """Response from bulk archive attempts."""

    success: bool
    message: str
    count: int


class UpdateChatCreatedAtRequest(BaseModel):
    """Request to update chat createdAt timestamp."""

    chatId: str
    createdAt: str


# Note: UpdateChatCompletedAtRequest removed - completed_at column was dropped from simulation_chats


class UpdateChatTimestampResponse(BaseModel):
    """Response from chat timestamp update."""

    success: bool
    message: str

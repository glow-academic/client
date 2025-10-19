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


class UpdateChatCompletedAtRequest(BaseModel):
    """Request to update chat completedAt timestamp."""

    chatId: str
    completedAt: str


class UpdateChatTimestampResponse(BaseModel):
    """Response from chat timestamp update."""

    success: bool
    message: str

"""Attempts schemas for v2 API."""

from typing import List

from pydantic import BaseModel


class BulkArchiveAttemptsRequest(BaseModel):
    """Request to bulk archive or unarchive simulation attempts."""

    attemptIds: List[str]
    archived: bool


class BulkArchiveAttemptsResponse(BaseModel):
    """Response from bulk archive attempts."""

    success: bool
    message: str
    count: int


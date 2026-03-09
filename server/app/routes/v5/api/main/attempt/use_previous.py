"""Attempt use-previous endpoint — copy grades from a previous attempt.

Synchronous equivalent of socket event: attempt_use_previous.
Reuses: socket/client/attempt/use_previous.py infra.

TODO: Wire to actual infra (copy attempt_chats from previous attempt).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptUsePreviousPayload

router = APIRouter()


class UsePreviousAttemptApiResponse(BaseModel):
    success: bool
    message: str | None = None


@router.post("/use-previous", response_model=UsePreviousAttemptApiResponse)
async def attempt_use_previous(
    request: AttemptUsePreviousPayload,
    http_request: Request,
) -> UsePreviousAttemptApiResponse:
    """Copy grades from a previous attempt's chats."""
    raise HTTPException(status_code=501, detail="Not implemented")

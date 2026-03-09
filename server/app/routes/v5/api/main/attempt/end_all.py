"""Attempt end-all endpoint — end all remaining chats in an attempt.

Synchronous equivalent of socket event: attempt_end_all.
Reuses: socket/client/attempt/end_all.py infra.

TODO: Wire to actual infra (end all chats, return summary).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptEndAllPayload

router = APIRouter()


class EndAllAttemptApiResponse(BaseModel):
    attempt_id: str
    success: bool
    all_scenarios_complete: bool = False
    message: str | None = None


@router.post("/end-all", response_model=EndAllAttemptApiResponse)
async def end_all_attempt(
    request: AttemptEndAllPayload,
    http_request: Request,
) -> EndAllAttemptApiResponse:
    """End all remaining chats in an attempt."""
    raise HTTPException(status_code=501, detail="Not implemented")

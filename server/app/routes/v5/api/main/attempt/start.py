"""Attempt start endpoint — creates a new attempt.

Synchronous equivalent of socket event: attempt_start.
Reuses: socket/client/attempt/start.py infra.

TODO: Wire to actual infra (create attempt entry, first chat, return IDs).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptStartPayload

router = APIRouter()


class StartAttemptApiResponse(BaseModel):
    attempt_id: str
    chat_entry_id: str


@router.post("/start", response_model=StartAttemptApiResponse)
async def start_attempt(
    request: AttemptStartPayload,
    http_request: Request,
) -> StartAttemptApiResponse:
    """Create a new attempt. Returns attempt_id + first chat_entry_id."""
    raise HTTPException(status_code=501, detail="Not implemented")

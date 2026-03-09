"""Attempt end endpoint — end a single chat within an attempt.

Synchronous equivalent of socket event: attempt_end.
Reuses: socket/client/attempt/end.py infra.

TODO: Wire to actual infra (end chat, optionally trigger grading).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptEndPayload

router = APIRouter()


class EndAttemptApiResponse(BaseModel):
    chat_id: str
    is_attempt_finished: bool | None = None
    grade_id: str | None = None


@router.post("/end", response_model=EndAttemptApiResponse)
async def end_attempt(
    request: AttemptEndPayload,
    http_request: Request,
) -> EndAttemptApiResponse:
    """End a single chat within an attempt. Optionally triggers grading."""
    raise HTTPException(status_code=501, detail="Not implemented")

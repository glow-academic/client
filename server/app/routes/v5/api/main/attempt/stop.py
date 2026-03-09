"""Attempt stop endpoint — stop message generation.

Synchronous equivalent of socket event: attempt_stop.
Reuses: socket/client/attempt/stop.py infra.

TODO: Wire to actual infra (cancel in-flight generation).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptStopPayload

router = APIRouter()


class StopAttemptApiResponse(BaseModel):
    chat_id: str
    success: bool
    message: str | None = None


@router.post("/stop", response_model=StopAttemptApiResponse)
async def attempt_stop(
    request: AttemptStopPayload,
    http_request: Request,
) -> StopAttemptApiResponse:
    """Stop message generation for an attempt chat."""
    raise HTTPException(status_code=501, detail="Not implemented")

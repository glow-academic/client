"""Attempt response endpoint — submit a video question response.

Synchronous equivalent of socket event: attempt_response_submit.
Reuses: socket/client/attempt/response.py infra.

TODO: Wire to actual infra (record response, return correctness).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptResponsePayload

router = APIRouter()


class ResponseAttemptApiResponse(BaseModel):
    success: bool
    message: str | None = None
    is_correct: bool | None = None


@router.post("/response", response_model=ResponseAttemptApiResponse)
async def attempt_response(
    request: AttemptResponsePayload,
    http_request: Request,
) -> ResponseAttemptApiResponse:
    """Submit a video question response."""
    raise HTTPException(status_code=501, detail="Not implemented")

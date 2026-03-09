"""Attempt next endpoint — proceed to next scenario in an attempt.

Synchronous equivalent of socket event: attempt_next.
Reuses: socket/client/attempt/next.py infra.

TODO: Wire to actual infra (find next scenario, create chat, return IDs).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptNextPayload

router = APIRouter()


class NextAttemptApiResponse(BaseModel):
    attempt_id: str
    chat_id: str


@router.post("/next", response_model=NextAttemptApiResponse)
async def next_attempt(
    request: AttemptNextPayload,
    http_request: Request,
) -> NextAttemptApiResponse:
    """Proceed to the next scenario in an existing attempt."""
    raise HTTPException(status_code=501, detail="Not implemented")

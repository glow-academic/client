"""Attempt message endpoint — send a message in an attempt chat.

Equivalent of socket event: attempt_message.
Unlike socket (which streams deltas), this returns the final assistant response.

Options for streaming: SSE via StreamingResponse if caller needs progressive output.

TODO: Wire to actual infra (create user message, trigger generation, return result).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptMessagePayload

router = APIRouter()


class MessageAttemptApiResponse(BaseModel):
    chat_id: str
    user_message_id: str
    assistant_message_id: str
    assistant_content: str
    hints: list[dict[str, Any]] | None = None


@router.post("/message", response_model=MessageAttemptApiResponse)
async def attempt_message(
    request: AttemptMessagePayload,
    http_request: Request,
) -> MessageAttemptApiResponse:
    """Send a message in an attempt chat. Returns final assistant response."""
    raise HTTPException(status_code=501, detail="Not implemented")

"""Attempt events endpoint — poll for chat events.

REST equivalent of socket events: attempt_join / attempt_leave.
Instead of subscribing to a room, agents poll for events with a cursor.

Event types mirror socket server-to-client events:
  - assistant_start, assistant_progress, assistant_complete
  - user_complete
  - grade_start, grade_progress, grade_complete
  - chat_ended, attempt_ended
  - error

TODO: Wire to actual infra (query event store by chat_id + cursor).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class AttemptEventsPayload(BaseModel):
    chat_id: UUID
    cursor: str | None = None
    types: list[str] | None = None
    limit: int = 50


class AttemptEvent(BaseModel):
    id: str
    type: str
    created: str
    data: dict[str, Any]


class AttemptEventsApiResponse(BaseModel):
    events: list[AttemptEvent]
    next_page_url: str | None = None
    previous_page_url: str | None = None


@router.post("/events", response_model=AttemptEventsApiResponse)
async def attempt_events(
    request: AttemptEventsPayload,
    http_request: Request,
) -> AttemptEventsApiResponse:
    """Poll for chat events. Returns events since cursor, with pagination URLs."""
    raise HTTPException(status_code=501, detail="Not implemented")

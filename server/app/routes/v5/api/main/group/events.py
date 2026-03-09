"""Group events endpoint — poll for generation events.

REST equivalent of generation progress that currently only streams via socket.

Event types mirror socket server-to-client events:
  - generation_progress
  - generation_complete
  - generation_saved
  - generation_error
  - media_progress, media_complete

TODO: Wire to actual infra (query event store by group_id + run_id + cursor).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class GroupEventsPayload(BaseModel):
    group_id: UUID
    run_id: UUID
    cursor: str | None = None
    types: list[str] | None = None
    limit: int = 50


class GroupEvent(BaseModel):
    id: str
    type: str
    created: str
    data: dict[str, Any]


class GroupEventsApiResponse(BaseModel):
    events: list[GroupEvent]
    next_page_url: str | None = None
    previous_page_url: str | None = None


@router.post("/events", response_model=GroupEventsApiResponse)
async def group_events(
    request: GroupEventsPayload,
    http_request: Request,
) -> GroupEventsApiResponse:
    """Poll for generation events. Returns events since cursor, with pagination URLs."""
    raise HTTPException(status_code=501, detail="Not implemented")

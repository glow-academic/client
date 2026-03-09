"""Test events endpoint — poll for test invocation events.

REST equivalent of socket events: test_join / test_leave.
Instead of subscribing to a room, agents poll for events with a cursor.

Event types mirror socket server-to-client events:
  - run_start, run_delta, run_complete
  - all_complete
  - graded
  - progress
  - stopped
  - error

TODO: Wire to actual infra (query event store by invocation_id + cursor).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class TestEventsPayload(BaseModel):
    invocation_id: UUID
    cursor: str | None = None
    types: list[str] | None = None
    limit: int = 50


class TestEvent(BaseModel):
    id: str
    type: str
    created: str
    data: dict[str, Any]


class TestEventsApiResponse(BaseModel):
    events: list[TestEvent]
    next_page_url: str | None = None
    previous_page_url: str | None = None


@router.post("/events", response_model=TestEventsApiResponse)
async def test_events(
    request: TestEventsPayload,
    http_request: Request,
) -> TestEventsApiResponse:
    """Poll for test invocation events. Returns events since cursor, with pagination URLs."""
    raise HTTPException(status_code=501, detail="Not implemented")

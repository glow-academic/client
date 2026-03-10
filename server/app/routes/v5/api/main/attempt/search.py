"""Attempt search endpoint — query attempt state, chats, and entries.

Allows agents to inspect the current state of an attempt: which chats exist,
what messages have been sent, what grades have been created, etc.

TODO: Wire to actual infra (query attempt state from DB/MVs).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class SearchAttemptApiRequest(BaseModel):
    # Filters
    attempt_id: UUID | None = None
    chat_id: UUID | None = None
    home_id: UUID | None = None
    practice_id: UUID | None = None
    # Entry type filters — which entry types to include in results
    include_entries: list[str] | None = None  # e.g. ["messages", "grades", "hints"]
    # Text search
    search: str | None = None
    # Pagination
    limit: int = 50
    cursor: str | None = None


class SearchAttemptApiResponse(BaseModel):
    results: list[dict[str, Any]]
    next_page_url: str | None = None
    previous_page_url: str | None = None


@router.post("/search", response_model=SearchAttemptApiResponse)
async def search_attempt(
    request: SearchAttemptApiRequest,
    http_request: Request,
) -> SearchAttemptApiResponse:
    """Search attempt state — chats, messages, grades, entries.

    Use include_entries to control which entry types are returned.
    Supports cursor-based pagination via next_page_url.
    """
    raise HTTPException(status_code=501, detail="Not implemented")

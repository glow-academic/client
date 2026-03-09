"""Test search endpoint — query test state, invocations, and runs.

Allows agents to inspect the current state of a test: which invocations exist,
which runs have been completed, what grades have been created, etc.

TODO: Wire to actual infra (query test state from DB/MVs).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class SearchTestApiRequest(BaseModel):
    # Filters
    test_id: UUID | None = None
    invocation_id: UUID | None = None
    benchmark_id: UUID | None = None
    run_id: UUID | None = None
    # Entry type filters
    include_entries: list[str] | None = None  # e.g. ["grades", "feedbacks"]
    # Text search
    search: str | None = None
    # Pagination
    limit: int = 50
    cursor: str | None = None


class SearchTestApiResponse(BaseModel):
    results: list[dict[str, Any]]
    next_page_url: str | None = None
    previous_page_url: str | None = None


@router.post("/search", response_model=SearchTestApiResponse)
async def search_test(
    request: SearchTestApiRequest,
    http_request: Request,
) -> SearchTestApiResponse:
    """Search test state — invocations, runs, grades, entries.

    Use include_entries to control which entry types are returned.
    Supports cursor-based pagination via next_page_url.
    """
    raise HTTPException(status_code=501, detail="Not implemented")

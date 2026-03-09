"""Test start endpoint — create a new test.

Synchronous equivalent of socket event: test_start.
Reuses: socket/client/test/start.py infra.

TODO: Wire to actual infra (create test entry, return test_id).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import TestStartPayload

router = APIRouter()


class StartTestApiResponse(BaseModel):
    test_id: str


@router.post("/start", response_model=StartTestApiResponse)
async def start_test(
    request: TestStartPayload,
    http_request: Request,
) -> StartTestApiResponse:
    """Create a new test."""
    raise HTTPException(status_code=501, detail="Not implemented")

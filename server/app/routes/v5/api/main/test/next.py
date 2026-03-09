"""Test next endpoint — find next pending run in an existing test.

Synchronous equivalent of socket event: test_next.
Reuses: socket/client/test/next.py infra.

TODO: Wire to actual infra (find next pending run, return invocation + run info).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import TestNextPayload

router = APIRouter()


class NextTestApiResponse(BaseModel):
    invocation_id: str
    run_id: str
    current_run: int
    total_runs: int


@router.post("/next", response_model=NextTestApiResponse)
async def next_test(
    request: TestNextPayload,
    http_request: Request,
) -> NextTestApiResponse:
    """Find next pending run in an existing test."""
    raise HTTPException(status_code=501, detail="Not implemented")

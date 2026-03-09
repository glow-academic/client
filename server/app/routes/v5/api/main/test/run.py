"""Test run endpoint — run one auto-regressive replay.

Fire-and-return equivalent of socket event: test_run.
Returns run_id immediately; progress streams via socket if connected.

TODO: Wire to actual infra (kick off replay, return job reference).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import TestRunPayload

router = APIRouter()


class RunTestApiResponse(BaseModel):
    test_id: str
    invocation_id: str
    run_id: str


@router.post("/run", response_model=RunTestApiResponse)
async def run_test(
    request: TestRunPayload,
    http_request: Request,
) -> RunTestApiResponse:
    """Run one auto-regressive replay. Returns immediately; progress via socket."""
    raise HTTPException(status_code=501, detail="Not implemented")

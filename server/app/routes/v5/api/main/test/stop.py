"""Test stop endpoint — stop current test execution.

Synchronous equivalent of socket event: test_stop.
Reuses: socket/client/test/stop.py infra.

TODO: Wire to actual infra (cancel in-flight test execution).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import TestStopPayload

router = APIRouter()


class StopTestApiResponse(BaseModel):
    invocation_id: str
    success: bool
    message: str | None = None


@router.post("/stop", response_model=StopTestApiResponse)
async def stop_test(
    request: TestStopPayload,
    http_request: Request,
) -> StopTestApiResponse:
    """Stop current test execution."""
    raise HTTPException(status_code=501, detail="Not implemented")

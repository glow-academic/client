"""Test end endpoint — end a single invocation within a test.

Synchronous equivalent of socket event: test_end.
Reuses: socket/client/test/end.py infra.

TODO: Wire to actual infra (end invocation, optionally trigger grading).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import TestEndPayload

router = APIRouter()


class EndTestApiResponse(BaseModel):
    invocation_id: str
    grade_id: str | None = None
    score: float | None = None
    passed: bool | None = None
    feedback: str | None = None


@router.post("/end", response_model=EndTestApiResponse)
async def end_test(
    request: TestEndPayload,
    http_request: Request,
) -> EndTestApiResponse:
    """End a single invocation within a test. Optionally triggers grading."""
    raise HTTPException(status_code=501, detail="Not implemented")

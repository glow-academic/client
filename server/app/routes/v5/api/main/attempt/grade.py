"""Attempt grade endpoint — trigger grading for an attempt chat.

Equivalent of socket event: attempt_grade.
Unlike socket (which streams per-criterion progress), this returns final grade.

TODO: Wire to actual infra (trigger grading pipeline, return aggregate result).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import AttemptGradePayload

router = APIRouter()


class GradeAttemptApiResponse(BaseModel):
    chat_id: str
    grade_id: str | None = None


@router.post("/grade", response_model=GradeAttemptApiResponse)
async def attempt_grade(
    request: AttemptGradePayload,
    http_request: Request,
) -> GradeAttemptApiResponse:
    """Trigger grading for an attempt chat. Returns aggregate grade result."""
    raise HTTPException(status_code=501, detail="Not implemented")

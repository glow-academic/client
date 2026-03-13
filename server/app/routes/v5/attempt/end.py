"""Attempt end endpoint — end a single chat within an attempt.

Synchronous equivalent of socket event: attempt_end.

When grade=True (default), triggers the grading pipeline. An agent can
optionally provide pre-computed grade data to skip the internal AI.

TODO: Wire to actual infra (end chat, optionally trigger or skip grading).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.infra.attempt.grade_types import (
    AttemptGradeAnalysisEntry,
    AttemptGradeFeedbackEntry,
    AttemptGradeHighlightEntry,
    AttemptGradeImprovementEntry,
    AttemptGradeReplacementEntry,
    AttemptGradeStrengthEntry,
)
from app.routes.v5.socket.internal.attempt.end import attempt_end_internal_impl

router = APIRouter()


class EndAttemptApiRequest(BaseModel):
    attempt_id: UUID
    chat_id: UUID
    grade: bool = True
    # Optional — agent can provide these, otherwise internal AI generates them
    # Only used when grade=True
    score: int | None = None
    passed: bool | None = None
    time_taken: int | None = None
    feedbacks: list[AttemptGradeFeedbackEntry] | None = None
    strengths: list[AttemptGradeStrengthEntry] | None = None
    improvements: list[AttemptGradeImprovementEntry] | None = None
    analyses: list[AttemptGradeAnalysisEntry] | None = None
    highlights: list[AttemptGradeHighlightEntry] | None = None
    replacements: list[AttemptGradeReplacementEntry] | None = None


class EndAttemptApiResponse(BaseModel):
    chat_id: str
    is_attempt_finished: bool | None = None
    grade_id: str | None = None
    score: int | None = None
    passed: bool | None = None


@router.post("/end", response_model=EndAttemptApiResponse)
async def end_attempt(
    request: EndAttemptApiRequest,
    http_request: Request,
) -> EndAttemptApiResponse:
    """End a single chat within an attempt.

    Browser client: sends grade=True, internal AI generates full grade.
    Agent: can optionally provide score, feedbacks, strengths, etc. to skip AI.
    """
    profile_id = getattr(http_request.state, "profile_id", None)
    session_id = getattr(http_request.state, "session_id", None)
    if not profile_id or not session_id:
        raise HTTPException(status_code=401, detail="Missing profile or session")

    try:
        result = await attempt_end_internal_impl(
            {
                "profile_id": str(profile_id),
                "session_id": str(session_id),
                **request.model_dump(mode="json"),
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return EndAttemptApiResponse.model_validate(result.model_dump(mode="json"))

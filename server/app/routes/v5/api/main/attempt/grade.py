"""Attempt grade endpoint — trigger grading for an attempt chat.

Equivalent of socket event: attempt_grade.

When called by a browser client, only attempt_id/chat_id is provided — the
internal AI generates grade, feedback, strengths, improvements, analyses,
highlights, and replacements.

When called by an agent, optional fields allow providing pre-computed results.
If optional fields are omitted, the internal AI pipeline runs as normal.

TODO: Wire to actual infra (trigger or skip grading pipeline).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.internal.attempt.grade import attempt_grade_internal_impl

router = APIRouter()


# ---------------------------------------------------------------------------
# Optional entry types (agent-provided, skip internal AI)
# ---------------------------------------------------------------------------


class FeedbackEntry(BaseModel):
    """Agent-provided feedback for a grade."""

    feedback: str
    total: int | None = None


class StrengthEntry(BaseModel):
    """Agent-provided strength for a grade."""

    name: str
    description: str
    message_id: UUID | None = None


class ImprovementEntry(BaseModel):
    """Agent-provided improvement for a grade."""

    name: str
    description: str
    message_id: UUID | None = None


class AnalysisEntry(BaseModel):
    """Agent-provided analysis for a grade."""

    content: str


class HighlightEntry(BaseModel):
    """Agent-provided highlight for a strength."""

    strength_id: UUID | None = None
    section: str
    idx: int | None = None


class ReplacementEntry(BaseModel):
    """Agent-provided replacement for an improvement."""

    improvement_id: UUID | None = None
    section: str
    replace: str
    idx: int | None = None


# ---------------------------------------------------------------------------
# Request / Response
# ---------------------------------------------------------------------------


class GradeAttemptApiRequest(BaseModel):
    attempt_id: UUID
    chat_id: UUID | None = None
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None
    # Optional — agent can provide these, otherwise internal AI generates them
    score: int | None = None
    passed: bool | None = None
    time_taken: int | None = None
    feedbacks: list[FeedbackEntry] | None = None
    strengths: list[StrengthEntry] | None = None
    improvements: list[ImprovementEntry] | None = None
    analyses: list[AnalysisEntry] | None = None
    highlights: list[HighlightEntry] | None = None
    replacements: list[ReplacementEntry] | None = None


class GradeAttemptApiResponse(BaseModel):
    chat_id: str
    grade_id: str | None = None
    score: int | None = None
    passed: bool | None = None


@router.post("/grade", response_model=GradeAttemptApiResponse)
async def attempt_grade(
    request: GradeAttemptApiRequest,
    http_request: Request,
) -> GradeAttemptApiResponse:
    """Trigger grading for an attempt chat.

    Browser client: sends chat_id only, internal AI generates full grade.
    Agent: can optionally provide score, feedbacks, strengths, etc. to skip AI.
    """
    profile_id = getattr(http_request.state, "profile_id", None)
    session_id = getattr(http_request.state, "session_id", None)
    if not profile_id or not session_id:
        raise HTTPException(status_code=401, detail="Missing profile or session")

    try:
        result = await attempt_grade_internal_impl(
            {
                "profile_id": str(profile_id),
                "session_id": str(session_id),
                **request.model_dump(mode="json"),
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GradeAttemptApiResponse.model_validate(result.model_dump(mode="json"))

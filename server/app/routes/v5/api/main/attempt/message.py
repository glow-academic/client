"""Attempt message endpoint — send a message in an attempt chat.

Equivalent of socket event: attempt_message.

When called by a browser client, only message is provided — the internal AI
generates the assistant response, hints, and content entries.

When called by an agent, optional fields allow providing pre-computed results:
  - assistant_content: skip LLM generation, use this as the response
  - hints: attach pre-computed hints to the message
  - content: attach pre-computed content entries

If optional fields are omitted, the internal AI pipeline runs as normal.

TODO: Wire to actual infra (create user message, trigger or skip generation).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Optional entry types (agent-provided, skip internal AI)
# ---------------------------------------------------------------------------


class HintEntry(BaseModel):
    """Agent-provided hint for a message."""

    hint: str
    message_id: UUID | None = None


class ContentEntry(BaseModel):
    """Agent-provided content entry for a message."""

    content: str
    persona_id: UUID | None = None


# ---------------------------------------------------------------------------
# Request / Response
# ---------------------------------------------------------------------------


class MessageAttemptApiRequest(BaseModel):
    attempt_id: UUID
    chat_id: UUID
    message: str
    parent_message_id: UUID | None = None
    # Optional — agent can provide these, otherwise internal AI generates them
    assistant_content: str | None = None
    hints: list[HintEntry] | None = None
    contents: list[ContentEntry] | None = None


class MessageAttemptApiResponse(BaseModel):
    chat_id: str
    user_message_id: str
    assistant_message_id: str
    assistant_content: str
    hints: list[dict[str, Any]] | None = None


@router.post("/message", response_model=MessageAttemptApiResponse)
async def attempt_message(
    request: MessageAttemptApiRequest,
    http_request: Request,
) -> MessageAttemptApiResponse:
    """Send a message in an attempt chat.

    Browser client: sends message only, internal AI generates response + hints.
    Agent: can optionally provide assistant_content, hints, contents to skip AI.
    """
    raise HTTPException(status_code=501, detail="Not implemented")

"""Attempt audio endpoint — upload-based audio submission for agents.

The client uploads audio via the existing uploads router (TUS or standard),
then passes the upload_id here. The server reads the file, transcribes it,
and returns the assistant response.

TODO: Wire to actual infra (read upload, transcribe, generate response).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# audio
# ---------------------------------------------------------------------------


class AudioPayload(BaseModel):
    chat_id: UUID
    upload_id: UUID


class AudioApiResponse(BaseModel):
    transcription: str
    assistant_message_id: str | None = None
    assistant_content: str | None = None


@router.post("/audio", response_model=AudioApiResponse)
async def attempt_audio(
    request: AudioPayload,
    http_request: Request,
) -> AudioApiResponse:
    """Submit audio for an attempt via upload_id. Returns transcription and assistant response."""
    raise HTTPException(status_code=501, detail="Not implemented")

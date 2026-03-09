"""Attempt audio endpoints — TUS-like audio session lifecycle for agents.

REST equivalent of socket events: attempt_audio_start, bidirectional audio stream,
attempt_audio_stop.

Agent creates a session, sends audio chunks (base64), gets back transcription
progress, ends the session.

TODO: Wire to actual infra (provision realtime session, process chunks, finalize).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# audio/start
# ---------------------------------------------------------------------------


class AudioStartPayload(BaseModel):
    chat_id: UUID


class AudioStartApiResponse(BaseModel):
    audio_session_id: str


@router.post("/audio/start", response_model=AudioStartApiResponse)
async def attempt_audio_start(
    request: AudioStartPayload,
    http_request: Request,
) -> AudioStartApiResponse:
    """Start a voice session. Returns an audio_session_id for subsequent calls."""
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# audio/chunk
# ---------------------------------------------------------------------------


class AudioChunkPayload(BaseModel):
    audio_session_id: str
    data: str  # base64-encoded audio
    mime_type: str | None = None


class AudioChunkApiResponse(BaseModel):
    offset: int
    transcription_delta: str | None = None


@router.post("/audio/chunk", response_model=AudioChunkApiResponse)
async def attempt_audio_chunk(
    request: AudioChunkPayload,
    http_request: Request,
) -> AudioChunkApiResponse:
    """Send an audio chunk. Returns current offset and transcription progress."""
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# audio/end
# ---------------------------------------------------------------------------


class AudioEndPayload(BaseModel):
    audio_session_id: str


class AudioEndApiResponse(BaseModel):
    transcription: str
    assistant_message_id: str | None = None
    assistant_content: str | None = None


@router.post("/audio/end", response_model=AudioEndApiResponse)
async def attempt_audio_end(
    request: AudioEndPayload,
    http_request: Request,
) -> AudioEndApiResponse:
    """End a voice session. Returns final transcription and assistant response."""
    raise HTTPException(status_code=501, detail="Not implemented")

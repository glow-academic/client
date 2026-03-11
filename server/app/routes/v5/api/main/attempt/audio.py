"""Attempt audio endpoints — HTTP adapters for audio session management.

Mirrors the WebSocket audio events (attempt_audio_start, attempt_audio_frame,
attempt_audio_stop) via HTTP. All fire-and-forget, return minimal ack responses.

For /audio/frame, the caller passes an upload_id pointing to an already-uploaded
audio file. The server reads the bytes and pushes them into the session queue —
the internal handler always works with raw bytes.
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.infra.globals import get_pool, get_upload_folder
from app.routes.v5.socket.client.attempt.audio.frame_impl import (
    attempt_audio_frame_internal_impl,
)
from app.routes.v5.socket.client.attempt.audio.start_impl import (
    AudioStartInternalResult,
    attempt_audio_start_internal_impl,
)
from app.routes.v5.socket.client.attempt.audio.stop_impl import (
    AudioStopInternalResult,
    attempt_audio_stop_internal_impl,
)
from app.routes.v5.tools.entries.uploads.get import get_upload

router = APIRouter()


# ---------------------------------------------------------------------------
# /audio/start
# ---------------------------------------------------------------------------


class AudioStartPayload(BaseModel):
    chat_id: UUID


@router.post("/audio/start", response_model=AudioStartInternalResult)
async def attempt_audio_start(
    request: AudioStartPayload,
    http_request: Request,
) -> AudioStartInternalResult:
    """Start an audio session for an attempt chat."""
    profile_id = getattr(http_request.state, "profile_id", None)
    session_id = getattr(http_request.state, "session_id", None)
    if not profile_id or not session_id:
        raise HTTPException(status_code=401, detail="Missing profile or session")

    try:
        return await attempt_audio_start_internal_impl(
            {
                "chat_id": str(request.chat_id),
                "profile_id": str(profile_id),
                "session_id": str(session_id),
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# /audio/frame
# ---------------------------------------------------------------------------


class AudioFramePayload(BaseModel):
    chat_id: UUID
    upload_id: UUID


class AudioFrameResponse(BaseModel):
    accepted: bool


@router.post("/audio/frame", response_model=AudioFrameResponse)
async def attempt_audio_frame(
    request: AudioFramePayload,
    http_request: Request,
) -> AudioFrameResponse:
    """Push audio bytes from an uploaded file into the session queue."""
    profile_id = getattr(http_request.state, "profile_id", None)
    if not profile_id:
        raise HTTPException(status_code=401, detail="Missing profile")

    pool = get_pool()

    # Step 1: Resolve upload → file path
    async with pool.acquire() as conn:
        upload = await get_upload(conn, request.upload_id)

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    # Step 2: Read audio bytes from disk
    file_path = get_upload_folder() / upload.file_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Upload file not found on disk")

    audio_bytes = Path(file_path).read_bytes()

    # Step 3: Push to session queue via internal impl
    accepted = attempt_audio_frame_internal_impl(
        chat_id=str(request.chat_id),
        audio=audio_bytes,
    )

    return AudioFrameResponse(accepted=accepted)


# ---------------------------------------------------------------------------
# /audio/stop
# ---------------------------------------------------------------------------


class AudioStopPayload(BaseModel):
    chat_id: UUID


@router.post("/audio/stop", response_model=AudioStopInternalResult)
async def attempt_audio_stop(
    request: AudioStopPayload,
    http_request: Request,
) -> AudioStopInternalResult:
    """Stop an audio session for an attempt chat."""
    profile_id = getattr(http_request.state, "profile_id", None)
    if not profile_id:
        raise HTTPException(status_code=401, detail="Missing profile")

    try:
        return await attempt_audio_stop_internal_impl({"chat_id": str(request.chat_id)})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

"""Group generate endpoint — trigger artifact generation.

Fire-and-return equivalent of socket event: generate.
Returns group_id + run_id immediately; progress streams via socket if connected.

TODO: Wire to actual infra (create group + run, emit to internal bus).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.routes.v5.socket.client.types import GeneratePayload

router = APIRouter()


class GenerateApiResponse(BaseModel):
    group_id: str
    run_id: str


@router.post("/generate", response_model=GenerateApiResponse)
async def generate(
    request: GeneratePayload,
    http_request: Request,
) -> GenerateApiResponse:
    """Trigger artifact generation. Returns immediately; progress via socket."""
    raise HTTPException(status_code=501, detail="Not implemented")

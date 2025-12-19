"""Simulation grading WebSocket event handlers."""

from fastapi import APIRouter

from .start import (
    client_router as grading_client_router,
)
from .start import (
    server_router as grading_server_router,
)
from .tools.audio import (
    client_router as audio_client_router,
)
from .tools.audio import (
    server_router as audio_server_router,
)

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(grading_client_router)
server_router.include_router(grading_server_router)
client_router.include_router(audio_client_router)
server_router.include_router(audio_server_router)

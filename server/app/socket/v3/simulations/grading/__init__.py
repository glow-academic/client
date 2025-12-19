"""Simulation grading WebSocket event handlers."""

from fastapi import APIRouter

from .start import (
    client_router as grading_client_router,
    server_router as grading_server_router,
)

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(grading_client_router)
server_router.include_router(grading_server_router)


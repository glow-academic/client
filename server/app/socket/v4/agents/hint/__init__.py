"""Simulation hints WebSocket event handlers."""

from fastapi import APIRouter

from .start import client_router as start_client_router
from .tools.debug import server_router as debug_server_router
from .tools.hint import server_router as hint_server_router

client_router = APIRouter(prefix="/hints", tags=["socket-client"])
server_router = APIRouter(prefix="/hints", tags=["socket-server"])

client_router.include_router(start_client_router)

server_router.include_router(debug_server_router)
server_router.include_router(hint_server_router)

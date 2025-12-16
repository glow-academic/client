"""Simulation WebSocket event handlers."""

from fastapi import APIRouter

from .join import client_router as join_client_router, server_router as join_server_router
from .leave import client_router as leave_client_router, server_router as leave_server_router
from .text import client_router as text_client_router, server_router as text_server_router
from .voice import client_router as voice_client_router, server_router as voice_server_router

client_router = APIRouter(prefix="/simulations", tags=["socket-client"])
server_router = APIRouter(prefix="/simulations", tags=["socket-server"])

client_router.include_router(join_client_router)
client_router.include_router(leave_client_router)
client_router.include_router(text_client_router)
client_router.include_router(voice_client_router)

server_router.include_router(join_server_router)
server_router.include_router(leave_server_router)
server_router.include_router(text_server_router)
server_router.include_router(voice_server_router)


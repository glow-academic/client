"""Image WebSocket event handlers."""

from fastapi import APIRouter

from .complete import client_router as complete_client_router
from .generate import client_router as generate_client_router

client_router = APIRouter(prefix="/images", tags=["socket-client"])
server_router = APIRouter(prefix="/images", tags=["socket-server"])

client_router.include_router(complete_client_router)
client_router.include_router(generate_client_router)

# Images only has client events, no server events

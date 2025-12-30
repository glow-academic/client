"""Text simulation WebSocket event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .error import server_router as error_server_router
from .progress import server_router as progress_server_router

client_router = APIRouter(prefix="/simulation", tags=["socket-client"])
server_router = APIRouter(prefix="/simulation", tags=["socket-server"])

server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)
server_router.include_router(progress_server_router)

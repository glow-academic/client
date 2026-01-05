"""Document template schema tool event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .progress import server_router as progress_server_router

client_router = APIRouter(prefix="/tools", tags=["socket-client"])
server_router = APIRouter(prefix="/tools", tags=["socket-server"])

server_router.include_router(progress_server_router)
server_router.include_router(complete_server_router)

__all__ = ["client_router", "server_router"]

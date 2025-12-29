"""Text simulation WebSocket event handlers."""

from fastapi import APIRouter

from .send import (
    client_router as send_client_router,
)
from .send import (
    server_router as send_server_router,
)
from .start import (
    client_router as start_client_router,
)
from .start import (
    server_router as start_server_router,
)
from .complete import server_router as complete_server_router
from .error import server_router as error_server_router
from .progress import server_router as progress_server_router

client_router = APIRouter(prefix="/text", tags=["socket-client"])
server_router = APIRouter(prefix="/text", tags=["socket-server"])

client_router.include_router(send_client_router)
client_router.include_router(start_client_router)

server_router.include_router(send_server_router)
server_router.include_router(start_server_router)
server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)
server_router.include_router(progress_server_router)

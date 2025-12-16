"""Text simulation WebSocket event handlers."""

from fastapi import APIRouter

from .end import client_router as end_client_router, server_router as end_server_router
from .next import client_router as next_client_router, server_router as next_server_router
from .practice import client_router as practice_client_router, server_router as practice_server_router
from .send import client_router as send_client_router, server_router as send_server_router
from .start import client_router as start_client_router, server_router as start_server_router
from .stop import client_router as stop_client_router, server_router as stop_server_router

client_router = APIRouter(prefix="/text", tags=["socket-client"])
server_router = APIRouter(prefix="/text", tags=["socket-server"])

client_router.include_router(end_client_router)
client_router.include_router(next_client_router)
client_router.include_router(practice_client_router)
client_router.include_router(send_client_router)
client_router.include_router(start_client_router)
client_router.include_router(stop_client_router)

server_router.include_router(end_server_router)
server_router.include_router(next_server_router)
server_router.include_router(practice_server_router)
server_router.include_router(send_server_router)
server_router.include_router(start_server_router)
server_router.include_router(stop_server_router)


"""Upload WebSocket event handlers."""

from fastapi import APIRouter

from .classify import (
    client_router as classify_client_router,
)
from .classify import (
    server_router as classify_server_router,
)

client_router = APIRouter(prefix="/uploads", tags=["socket-client"])
server_router = APIRouter(prefix="/uploads", tags=["socket-server"])

client_router.include_router(classify_client_router)
server_router.include_router(classify_server_router)


"""Rubric WebSocket event handlers."""

from fastapi import APIRouter

from .generate import (
    client_router as generate_client_router,
)
from .generate import (
    server_router as generate_server_router,
)
from .tools import (
    client_router as tools_client_router,
)
from .tools import (
    server_router as tools_server_router,
)

client_router = APIRouter(prefix="/rubrics", tags=["socket-client"])
server_router = APIRouter(prefix="/rubrics", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(tools_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(tools_server_router)

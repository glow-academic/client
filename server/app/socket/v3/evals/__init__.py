"""Eval WebSocket event handlers."""

from fastapi import APIRouter

from .enter import (
    client_router as enter_client_router,
)
from .enter import (
    server_router as enter_server_router,
)
from .join import (
    client_router as join_client_router,
)
from .join import (
    server_router as join_server_router,
)
from .leave import (
    client_router as leave_client_router,
)
from .leave import (
    server_router as leave_server_router,
)

client_router = APIRouter(prefix="/evals", tags=["socket-client"])
server_router = APIRouter(prefix="/evals", tags=["socket-server"])

client_router.include_router(enter_client_router)
client_router.include_router(join_client_router)
client_router.include_router(leave_client_router)

server_router.include_router(enter_server_router)
server_router.include_router(join_server_router)
server_router.include_router(leave_server_router)

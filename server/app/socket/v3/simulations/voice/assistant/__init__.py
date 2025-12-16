"""Voice assistant WebSocket event handlers."""

from fastapi import APIRouter

from .delta import (
    client_router as delta_client_router,
)
from .delta import (
    server_router as delta_server_router,
)
from .done import (
    client_router as done_client_router,
)
from .done import (
    server_router as done_server_router,
)
from .interrupted import (
    client_router as interrupted_client_router,
)
from .interrupted import (
    server_router as interrupted_server_router,
)

client_router = APIRouter(prefix="/assistant", tags=["socket-client"])
server_router = APIRouter(prefix="/assistant", tags=["socket-server"])

client_router.include_router(delta_client_router)
client_router.include_router(done_client_router)
client_router.include_router(interrupted_client_router)

server_router.include_router(delta_server_router)
server_router.include_router(done_server_router)
server_router.include_router(interrupted_server_router)

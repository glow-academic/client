"""Simulation WebSocket event handlers."""

from fastapi import APIRouter

from .end import (
    client_router as end_client_router,
)
from .end import (
    server_router as end_server_router,
)
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
from .next import (
    client_router as next_client_router,
)
from .next import (
    server_router as next_server_router,
)
from .advance import (
    client_router as advance_client_router,
)
from .advance import (
    server_router as advance_server_router,
)
from .start import (
    client_router as start_client_router,
)
from .start import (
    server_router as start_server_router,
)
from .stop import (
    client_router as stop_client_router,
)
from .stop import (
    server_router as stop_server_router,
)

client_router = APIRouter(prefix="/simulations", tags=["socket-client"])
server_router = APIRouter(prefix="/simulations", tags=["socket-server"])

client_router.include_router(enter_client_router)
client_router.include_router(join_client_router)
client_router.include_router(leave_client_router)
client_router.include_router(start_client_router)
client_router.include_router(end_client_router)
client_router.include_router(next_client_router)
client_router.include_router(advance_client_router)
client_router.include_router(stop_client_router)

server_router.include_router(enter_server_router)
server_router.include_router(join_server_router)
server_router.include_router(leave_server_router)
server_router.include_router(start_server_router)
server_router.include_router(end_server_router)
server_router.include_router(next_server_router)
server_router.include_router(advance_server_router)
server_router.include_router(stop_server_router)

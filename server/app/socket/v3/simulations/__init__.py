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
from .practice import (
    client_router as practice_client_router,
)
from .practice import (
    server_router as practice_server_router,
)
from .randomize import (
    client_router as randomize_client_router,
)
from .stop import (
    client_router as stop_client_router,
)
from .stop import (
    server_router as stop_server_router,
)
from .streaming import (
    client_router as streaming_client_router,
)
from .streaming import (
    server_router as streaming_server_router,
)

client_router = APIRouter(prefix="/simulations", tags=["socket-client"])
server_router = APIRouter(prefix="/simulations", tags=["socket-server"])

client_router.include_router(enter_client_router)
client_router.include_router(join_client_router)
client_router.include_router(leave_client_router)
client_router.include_router(streaming_client_router)
client_router.include_router(end_client_router)
client_router.include_router(practice_client_router)
client_router.include_router(stop_client_router)
client_router.include_router(randomize_client_router)

server_router.include_router(enter_server_router)
server_router.include_router(join_server_router)
server_router.include_router(leave_server_router)
server_router.include_router(streaming_server_router)
server_router.include_router(end_server_router)
server_router.include_router(practice_server_router)
server_router.include_router(stop_server_router)

"""Simulation WebSocket event handlers."""

from fastapi import APIRouter

from .enter import (
    client_router as enter_client_router,
)
from .enter import (
    server_router as enter_server_router,
)
from .grading import (
    client_router as grading_client_router,
)
from .grading import (
    server_router as grading_server_router,
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
from .streaming import (
    client_router as streaming_client_router,
)
from .streaming import (
    server_router as streaming_server_router,
)
from .text import (
    client_router as text_client_router,
)
from .text import (
    server_router as text_server_router,
)
from .voice import (
    client_router as voice_client_router,
)
from .voice import (
    server_router as voice_server_router,
)

client_router = APIRouter(prefix="/simulations", tags=["socket-client"])
server_router = APIRouter(prefix="/simulations", tags=["socket-server"])

client_router.include_router(enter_client_router)
client_router.include_router(join_client_router)
client_router.include_router(leave_client_router)
client_router.include_router(text_client_router)
client_router.include_router(voice_client_router)
client_router.include_router(grading_client_router)
client_router.include_router(streaming_client_router)

server_router.include_router(enter_server_router)
server_router.include_router(join_server_router)
server_router.include_router(leave_server_router)
server_router.include_router(text_server_router)
server_router.include_router(voice_server_router)
server_router.include_router(grading_server_router)
server_router.include_router(streaming_server_router)

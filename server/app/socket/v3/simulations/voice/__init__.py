"""Voice simulation WebSocket event handlers."""

from fastapi import APIRouter

from .assistant import (
    client_router as assistant_client_router,
)
from .assistant import (
    server_router as assistant_server_router,
)
from .debug import (
    client_router as debug_client_router,
)
from .debug import (
    server_router as debug_server_router,
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
from .user import (
    client_router as user_client_router,
)
from .user import (
    server_router as user_server_router,
)

client_router = APIRouter(prefix="/voice", tags=["socket-client"])
server_router = APIRouter(prefix="/voice", tags=["socket-server"])

client_router.include_router(start_client_router)
client_router.include_router(stop_client_router)
client_router.include_router(debug_client_router)
client_router.include_router(user_client_router)
client_router.include_router(assistant_client_router)

server_router.include_router(start_server_router)
server_router.include_router(stop_server_router)
server_router.include_router(debug_server_router)
server_router.include_router(user_server_router)
server_router.include_router(assistant_server_router)

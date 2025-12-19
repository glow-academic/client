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
from .process_next import (
    server_router as process_next_server_router,
)
from .run_start import (
    client_router as run_start_client_router,
)
from .run_start import (
    server_router as run_start_server_router,
)
from .run_stop import (
    client_router as run_stop_client_router,
)
from .run_stop import (
    server_router as run_stop_server_router,
)
from .runs_start_all import (
    client_router as runs_start_all_client_router,
)
from .runs_start_all import (
    server_router as runs_start_all_server_router,
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

client_router = APIRouter(prefix="/evals", tags=["socket-client"])
server_router = APIRouter(prefix="/evals", tags=["socket-server"])

client_router.include_router(enter_client_router)
client_router.include_router(join_client_router)
client_router.include_router(leave_client_router)
client_router.include_router(start_client_router)
client_router.include_router(stop_client_router)
client_router.include_router(run_start_client_router)
client_router.include_router(runs_start_all_client_router)
client_router.include_router(run_stop_client_router)

server_router.include_router(enter_server_router)
server_router.include_router(join_server_router)
server_router.include_router(leave_server_router)
server_router.include_router(start_server_router)
server_router.include_router(process_next_server_router)
server_router.include_router(stop_server_router)
server_router.include_router(run_start_server_router)
server_router.include_router(runs_start_all_server_router)
server_router.include_router(run_stop_server_router)

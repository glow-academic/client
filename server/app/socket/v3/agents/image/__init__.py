"""Image WebSocket event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .error import server_router as error_server_router

server_router.include_router(eval_server_router)
from .eval import server_router as eval_server_router
from .generate import client_router as generate_client_router
from .progress import server_router as progress_server_router

server_router.include_router(title_server_router)
server_router.include_router(debug_server_router)

from .tools.debug import (
    client_router as debug_client_router,
)
from .tools.debug import (
    server_router as debug_server_router,
)
from .tools.title import (
    client_router as title_client_router,
)
from .tools.title import (
    server_router as title_server_router,
)

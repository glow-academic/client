"""Document WebSocket event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .error import server_router as error_server_router
from .eval import server_router as eval_server_router
from .generate import (
    client_router as generate_client_router,
)
from .generate import (
    server_router as generate_server_router,
)
from .progress import server_router as progress_server_router
from .tools.debug import (
    client_router as debug_client_router,
)
from .tools.debug import (
    server_router as debug_server_router,
)
from .tools.html import (
    server_router as html_server_router,
)
from .tools.schema import (
    server_router as schema_server_router,
)
from .tools.title import (
    client_router as title_client_router,
)
from .tools.title import (
    server_router as title_server_router,
)

client_router = APIRouter(prefix="/documents", tags=["socket-client"])
server_router = APIRouter(prefix="/documents", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(title_client_router)
client_router.include_router(debug_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)
server_router.include_router(progress_server_router)
server_router.include_router(eval_server_router)
server_router.include_router(title_server_router)
server_router.include_router(html_server_router)
server_router.include_router(schema_server_router)
server_router.include_router(debug_server_router)

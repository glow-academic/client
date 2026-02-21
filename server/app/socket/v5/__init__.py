"""Socket v5 API — unified WebSocket client + internal layer.

Provides a single `generate` event handler that works for ALL draft artifact
types via a registry pattern, replacing the per-artifact `{artifact}_generate`
handlers in v4.
"""

from fastapi import APIRouter

from . import client, internal, server  # noqa: F401 — registers handlers on import
from .server.entries import server_router as entries_server_router
from .server.resources import server_router as resources_server_router

router = APIRouter(prefix="/socket/v5", tags=["socket-v5"])
server_api_router = APIRouter(prefix="/server", tags=["socket-v5-server"])
server_api_router.include_router(resources_server_router)
server_api_router.include_router(entries_server_router)
router.include_router(server_api_router)

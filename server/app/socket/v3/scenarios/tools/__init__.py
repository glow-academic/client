"""Scenario tool WebSocket event handlers."""

from fastapi import APIRouter

from .document import (
    client_router as document_client_router,
)
from .document import (
    server_router as document_server_router,
)
from .image import (
    client_router as image_client_router,
)
from .image import (
    server_router as image_server_router,
)
from .objectives import (
    client_router as objectives_client_router,
)
from .objectives import (
    server_router as objectives_server_router,
)
from .questions import (
    client_router as questions_client_router,
)
from .questions import (
    server_router as questions_server_router,
)
from .statement import (
    client_router as statement_client_router,
)
from .statement import (
    server_router as statement_server_router,
)
from .video import (
    client_router as video_client_router,
)
from .video import (
    server_router as video_server_router,
)

client_router = APIRouter(prefix="/tools", tags=["socket-client"])
server_router = APIRouter(prefix="/tools", tags=["socket-server"])

client_router.include_router(document_client_router)
client_router.include_router(statement_client_router)
client_router.include_router(objectives_client_router)
client_router.include_router(image_client_router)
client_router.include_router(video_client_router)
client_router.include_router(questions_client_router)

server_router.include_router(document_server_router)
server_router.include_router(statement_server_router)
server_router.include_router(objectives_server_router)
server_router.include_router(image_server_router)
server_router.include_router(video_server_router)
server_router.include_router(questions_server_router)

"""Voice user WebSocket event handlers."""

from fastapi import APIRouter

from .delta import (
    client_router as delta_client_router,
)
from .delta import (
    server_router as delta_server_router,
)
from .speech import client_router as speech_client_router
from .start import (
    client_router as start_client_router,
)
from .start import (
    server_router as start_server_router,
)
from .text import (
    client_router as text_client_router,
)
from .text import (
    server_router as text_server_router,
)
from .transcript import (
    client_router as transcript_client_router,
)
from .transcript import (
    server_router as transcript_server_router,
)

client_router = APIRouter(prefix="/user", tags=["socket-client"])
server_router = APIRouter(prefix="/user", tags=["socket-server"])

client_router.include_router(start_client_router)
client_router.include_router(delta_client_router)
client_router.include_router(transcript_client_router)
client_router.include_router(text_client_router)
client_router.include_router(speech_client_router)

server_router.include_router(start_server_router)
server_router.include_router(delta_server_router)
server_router.include_router(transcript_server_router)
server_router.include_router(text_server_router)

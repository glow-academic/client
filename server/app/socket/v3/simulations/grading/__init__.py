"""Simulation grading WebSocket event handlers."""

from fastapi import APIRouter

from .start import (
    client_router as grading_client_router,
)
from .start import (
    server_router as grading_server_router,
)
from .tools.audio import (
    client_router as audio_client_router,
)
from .tools.audio import (
    server_router as audio_server_router,
)
from .tools.feedback import (
    client_router as feedback_client_router,
)
from .tools.feedback import (
    server_router as feedback_server_router,
)
from .tools.message_improvement import (
    client_router as message_improvement_client_router,
)
from .tools.message_improvement import (
    server_router as message_improvement_server_router,
)
from .tools.message_strength import (
    client_router as message_strength_client_router,
)
from .tools.message_strength import (
    server_router as message_strength_server_router,
)

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(grading_client_router)
server_router.include_router(grading_server_router)
client_router.include_router(audio_client_router)
server_router.include_router(audio_server_router)
client_router.include_router(feedback_client_router)
server_router.include_router(feedback_server_router)
client_router.include_router(message_strength_client_router)
server_router.include_router(message_strength_server_router)
client_router.include_router(message_improvement_client_router)
server_router.include_router(message_improvement_server_router)

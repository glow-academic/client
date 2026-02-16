"""Per-entry socket event handlers.

Each entry module registers its own internal_sio listeners
and provides server_router endpoints for OpenAPI documentation.
"""

from fastapi import APIRouter

from .analyses import server_router as analyses_server_router
from .contents import server_router as contents_server_router
from .feedbacks import server_router as feedbacks_server_router
from .highlights import server_router as highlights_server_router
from .hints import server_router as hints_server_router
from .improvements import server_router as improvements_server_router
from .replacements import server_router as replacements_server_router
from .responses import server_router as responses_server_router
from .simulation_messages import server_router as simulation_messages_server_router
from .strengths import server_router as strengths_server_router

server_router = APIRouter()

server_router.include_router(analyses_server_router)
server_router.include_router(contents_server_router)
server_router.include_router(feedbacks_server_router)
server_router.include_router(highlights_server_router)
server_router.include_router(hints_server_router)
server_router.include_router(improvements_server_router)
server_router.include_router(replacements_server_router)
server_router.include_router(responses_server_router)
server_router.include_router(simulation_messages_server_router)
server_router.include_router(strengths_server_router)

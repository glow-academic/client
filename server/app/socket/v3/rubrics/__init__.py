"""Rubric WebSocket event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .error import server_router as error_server_router
from .generate import client_router as generate_client_router
from .generate import server_router as generate_server_router
from .progress import server_router as progress_server_router
from .regenerate import client_router as regenerate_client_router
from .standard_group_descriptions import \
    client_router as standard_group_descriptions_client_router
from .standard_group_descriptions import \
    server_router as standard_group_descriptions_server_router

client_router = APIRouter(prefix="/rubrics", tags=["socket-client"])
server_router = APIRouter(prefix="/rubrics", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(regenerate_client_router)
client_router.include_router(standard_group_descriptions_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(standard_group_descriptions_server_router)
server_router.include_router(progress_server_router)
server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)

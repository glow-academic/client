"""Scenario WebSocket event handlers."""

from fastapi import APIRouter

from .generate import client_router as generate_client_router, server_router as generate_server_router
from .regenerate import client_router as regenerate_client_router, server_router as regenerate_server_router
from .tools import client_router as tools_client_router, server_router as tools_server_router

client_router = APIRouter(prefix="/scenarios", tags=["socket-client"])
server_router = APIRouter(prefix="/scenarios", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(regenerate_client_router)
client_router.include_router(tools_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(regenerate_server_router)
server_router.include_router(tools_server_router)


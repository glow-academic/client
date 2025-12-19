"""Unified streaming event handlers for simulations."""

from fastapi import APIRouter

from .message import (
    client_router as message_client_router,
    server_router as message_server_router,
)
from .tool_call import (
    client_router as tool_call_client_router,
    server_router as tool_call_server_router,
)

client_router = APIRouter()
server_router = APIRouter()

client_router.include_router(message_client_router)
client_router.include_router(tool_call_client_router)

server_router.include_router(message_server_router)
server_router.include_router(tool_call_server_router)


"""Personas socket v4 API routers - handles persona resource generation events."""

from fastapi import APIRouter

from . import descriptions, generate, instructions, names

client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(generate.client_router)
client_router.include_router(names.client_router)
client_router.include_router(descriptions.client_router)
client_router.include_router(instructions.client_router)

# Register server-to-server events
server_router.include_router(generate.server_router)
server_router.include_router(names.server_router)
server_router.include_router(descriptions.server_router)
server_router.include_router(instructions.server_router)

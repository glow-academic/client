"""Profile socket v4 API routers - handles profile resource generation events."""

from fastapi import APIRouter

from . import complete, error, generate, progress

client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(generate.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(generate.server_router)
server_router.include_router(progress.server_router)
server_router.include_router(complete.server_router)
server_router.include_router(error.server_router)

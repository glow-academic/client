"""Attempts WebSocket event handlers - general, practice, simulation, and benchmark operations."""

from fastapi import APIRouter

from . import benchmark, general, practice, simulation

client_router = APIRouter()
server_router = APIRouter()

# Include general routers
client_router.include_router(general.client_router)
server_router.include_router(general.server_router)

# Include practice routers
client_router.include_router(practice.client_router)
server_router.include_router(practice.server_router)

# Include simulation routers (unified attempt generation)
client_router.include_router(simulation.client_router)
server_router.include_router(simulation.server_router)

# Include benchmark routers
client_router.include_router(benchmark.client_router)
server_router.include_router(benchmark.server_router)

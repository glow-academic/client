"""Attempts WebSocket event handlers - simulation and benchmark operations."""

from fastapi import APIRouter

from . import benchmark, simulation

client_router = APIRouter()
server_router = APIRouter()

# Include simulation routers
client_router.include_router(simulation.client_router)
server_router.include_router(simulation.server_router)

# Include benchmark routers
client_router.include_router(benchmark.client_router)
server_router.include_router(benchmark.server_router)

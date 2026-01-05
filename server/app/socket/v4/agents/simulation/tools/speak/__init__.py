"""Simulation speak tool handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .progress import server_router as progress_server_router

client_router = APIRouter()
server_router = APIRouter()

server_router.include_router(progress_server_router)
server_router.include_router(complete_server_router)

"""Simulation hints WebSocket event handlers."""

from fastapi import APIRouter

from .generate import client_router as generate_client_router
from .generate import server_router as generate_server_router

client_router = APIRouter(prefix="/hints", tags=["socket-client"])
server_router = APIRouter(prefix="/hints", tags=["socket-server"])

client_router.include_router(generate_client_router)
server_router.include_router(generate_server_router)


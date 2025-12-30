"""Speak tool event handlers."""

from fastapi import APIRouter

client_router = APIRouter(prefix="/tools", tags=["socket-client"])
server_router = APIRouter(prefix="/tools", tags=["socket-server"])


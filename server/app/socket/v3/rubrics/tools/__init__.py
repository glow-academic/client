"""Rubric generation tools."""

from fastapi import APIRouter

from .standard_group_descriptions import (
    client_router as standard_group_descriptions_client_router,
)
from .standard_group_descriptions import (
    server_router as standard_group_descriptions_server_router,
)

client_router = APIRouter(prefix="/tools", tags=["socket-client"])
server_router = APIRouter(prefix="/tools", tags=["socket-server"])

client_router.include_router(standard_group_descriptions_client_router)

server_router.include_router(standard_group_descriptions_server_router)

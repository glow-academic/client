"""Responses entry socket event handlers."""

from fastapi import APIRouter

from . import complete as _complete  # noqa: F401
from . import error as _error  # noqa: F401
from .complete import server_router as complete_router
from .error import server_router as error_router

server_router = APIRouter()

server_router.include_router(complete_router)
server_router.include_router(error_router)

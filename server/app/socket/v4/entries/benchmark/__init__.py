"""Benchmark entry socket event handlers."""

from fastapi import APIRouter

# Import handler modules to register internal_sio listeners
from . import complete as _complete  # noqa: F401
from . import error as _error  # noqa: F401
from . import progress as _progress  # noqa: F401
from . import start as _start  # noqa: F401
from .complete import server_router as complete_router
from .error import server_router as error_router
from .progress import server_router as progress_router
from .start import server_router as start_router

server_router = APIRouter()

server_router.include_router(start_router)
server_router.include_router(progress_router)
server_router.include_router(complete_router)
server_router.include_router(error_router)

"""Per-resource socket event handlers.

Aggregates server_routers from all per-resource modules and imports the
dispatcher to register internal_sio listeners.
"""

from fastapi import APIRouter

from . import dispatcher  # noqa: F401 — registers internal_sio listeners
from .colors import server_router as colors_server_router
from .departments import server_router as departments_server_router
from .descriptions import server_router as descriptions_server_router
from .examples import server_router as examples_server_router
from .flags import server_router as flags_server_router
from .icons import server_router as icons_server_router
from .instructions import server_router as instructions_server_router
from .names import server_router as names_server_router
from .parameter_fields import server_router as parameter_fields_server_router
from .parameters import server_router as parameters_server_router

server_router = APIRouter()

server_router.include_router(names_server_router)
server_router.include_router(descriptions_server_router)
server_router.include_router(colors_server_router)
server_router.include_router(icons_server_router)
server_router.include_router(instructions_server_router)
server_router.include_router(flags_server_router)
server_router.include_router(departments_server_router)
server_router.include_router(parameter_fields_server_router)
server_router.include_router(examples_server_router)
server_router.include_router(parameters_server_router)

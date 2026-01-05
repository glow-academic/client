"""Prompt agent WebSocket event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .error import server_router as error_server_router
from .eval import server_router as eval_server_router
from .generate import (
    client_router as generate_client_router,
)
from .generate import (
    server_router as generate_server_router,
)
from .progress import (
    server_router as progress_server_router,
)
from .regenerate import (
    client_router as regenerate_client_router,
)
from .regenerate import (
    server_router as regenerate_server_router,
)
from .tools.instruct import (
    client_router as instruct_client_router,
)
from .tools.instruct import (
    server_router as instruct_server_router,
)
from .tools.prompt import (
    client_router as prompt_tool_client_router,
)
from .tools.prompt import (
    server_router as prompt_tool_server_router,
)

client_router = APIRouter(prefix="/prompts", tags=["socket-client"])
server_router = APIRouter(prefix="/prompts", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(regenerate_client_router)
client_router.include_router(instruct_client_router)
client_router.include_router(prompt_tool_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)
server_router.include_router(eval_server_router)
server_router.include_router(progress_server_router)
server_router.include_router(regenerate_server_router)
server_router.include_router(instruct_server_router)
server_router.include_router(prompt_tool_server_router)

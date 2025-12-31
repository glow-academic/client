"""Scenario WebSocket event handlers."""

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
from .progress import server_router as progress_server_router
from .regenerate import (
    client_router as regenerate_client_router,
)
from .regenerate import (
    server_router as regenerate_server_router,
)
from .tools.debug import (
    client_router as debug_client_router,
)
from .tools.debug import (
    server_router as debug_server_router,
)
from .tools.document import (
    client_router as document_client_router,
)
from .tools.document import (
    server_router as document_server_router,
)
from .tools.image import (
    client_router as image_client_router,
)
from .tools.image import (
    server_router as image_server_router,
)
from .tools.objective import (
    client_router as objective_client_router,
)
from .tools.objective import (
    server_router as objective_server_router,
)
from .tools.question import (
    client_router as question_client_router,
)
from .tools.question import (
    server_router as question_server_router,
)
from .tools.statement import (
    client_router as statement_client_router,
)
from .tools.statement import (
    server_router as statement_server_router,
)
from .tools.title import (
    client_router as title_client_router,
)
from .tools.title import (
    server_router as title_server_router,
)
from .tools.video import (
    client_router as video_client_router,
)
from .tools.video import (
    server_router as video_server_router,
)

client_router = APIRouter(prefix="/scenarios", tags=["socket-client"])
server_router = APIRouter(prefix="/scenarios", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(regenerate_client_router)
client_router.include_router(debug_client_router)
client_router.include_router(document_client_router)
client_router.include_router(image_client_router)
client_router.include_router(objective_client_router)
client_router.include_router(question_client_router)
client_router.include_router(statement_client_router)
client_router.include_router(title_client_router)
client_router.include_router(video_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(regenerate_server_router)
server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)
server_router.include_router(progress_server_router)
server_router.include_router(eval_server_router)
server_router.include_router(debug_server_router)
server_router.include_router(document_server_router)
server_router.include_router(image_server_router)
server_router.include_router(objective_server_router)
server_router.include_router(question_server_router)
server_router.include_router(statement_server_router)
server_router.include_router(title_server_router)
server_router.include_router(video_server_router)

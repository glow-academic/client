"""Grade text WebSocket event handlers."""

from fastapi import APIRouter

from .complete import server_router as complete_server_router
from .error import server_router as error_server_router
from .eval import server_router as eval_server_router
from .generate import client_router as generate_client_router
from .generate import server_router as generate_server_router
from .progress import server_router as progress_server_router
from .tools.audio import (
    client_router as audio_client_router,
)
from .tools.audio import (
    server_router as audio_server_router,
)
from .tools.debug import (
    client_router as debug_client_router,
)
from .tools.debug import (
    server_router as debug_server_router,
)
from .tools.grade import (
    client_router as grade_client_router,
)
from .tools.grade import (
    server_router as grade_server_router,
)
from .tools.improvement import (
    client_router as improvement_client_router,
)
from .tools.improvement import (
    server_router as improvement_server_router,
)
from .tools.strength import (
    client_router as strength_client_router,
)
from .tools.strength import (
    server_router as strength_server_router,
)

client_router = APIRouter(prefix="/grades", tags=["socket-client"])
server_router = APIRouter(prefix="/grades", tags=["socket-server"])

client_router.include_router(generate_client_router)
client_router.include_router(audio_client_router)
client_router.include_router(improvement_client_router)
client_router.include_router(strength_client_router)
client_router.include_router(grade_client_router)
client_router.include_router(debug_client_router)

server_router.include_router(generate_server_router)
server_router.include_router(complete_server_router)
server_router.include_router(error_server_router)
server_router.include_router(progress_server_router)
server_router.include_router(eval_server_router)
server_router.include_router(audio_server_router)
server_router.include_router(improvement_server_router)
server_router.include_router(strength_server_router)
server_router.include_router(grade_server_router)
server_router.include_router(debug_server_router)

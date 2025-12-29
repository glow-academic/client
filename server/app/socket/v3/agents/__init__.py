"""WebSocket agent event handlers."""

from fastapi import APIRouter

from .classify import client_router as classify_client_router
from .classify import server_router as classify_server_router
from .document import client_router as document_client_router
from .document import server_router as document_server_router
from .eval import client_router as eval_client_router
from .eval import server_router as eval_server_router
from .grade_text import client_router as grade_text_client_router
from .grade_text import server_router as grade_text_server_router
from .grade_voice import client_router as grade_voice_client_router
from .grade_voice import server_router as grade_voice_server_router
from .hint import client_router as hint_client_router
from .hint import server_router as hint_server_router
from .image import client_router as image_client_router
from .image import server_router as image_server_router
from .rubric import client_router as rubric_client_router
from .rubric import server_router as rubric_server_router
from .scenario import client_router as scenario_client_router
from .scenario import server_router as scenario_server_router
from .simulation_text import (
    client_router as simulation_text_client_router,
)
from .simulation_text import (
    server_router as simulation_text_server_router,
)
from .simulation_voice import (
    client_router as simulation_voice_client_router,
)
from .simulation_voice import (
    server_router as simulation_voice_server_router,
)
from .video import client_router as video_client_router
from .video import server_router as video_server_router

client_router = APIRouter(prefix="/agents", tags=["socket-client"])
server_router = APIRouter(prefix="/agents", tags=["socket-server"])

client_router.include_router(simulation_text_client_router)
client_router.include_router(simulation_voice_client_router)
client_router.include_router(scenario_client_router)
client_router.include_router(document_client_router)
client_router.include_router(video_client_router)
client_router.include_router(image_client_router)
client_router.include_router(eval_client_router)
client_router.include_router(rubric_client_router)
client_router.include_router(classify_client_router)
client_router.include_router(hint_client_router)
client_router.include_router(grade_text_client_router)
client_router.include_router(grade_voice_client_router)

server_router.include_router(simulation_text_server_router)
server_router.include_router(simulation_voice_server_router)
server_router.include_router(scenario_server_router)
server_router.include_router(document_server_router)
server_router.include_router(video_server_router)
server_router.include_router(image_server_router)
server_router.include_router(eval_server_router)
server_router.include_router(rubric_server_router)
server_router.include_router(classify_server_router)
server_router.include_router(hint_server_router)
server_router.include_router(grade_text_server_router)
server_router.include_router(grade_voice_server_router)


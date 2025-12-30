"""WebSocket tool event handlers."""

from fastapi import APIRouter

from .audio import client_router as audio_client_router
from .audio import server_router as audio_server_router
from .document import client_router as document_client_router
from .document import server_router as document_server_router
from .feedback import client_router as feedback_client_router
from .feedback import server_router as feedback_server_router
from .image import client_router as image_client_router
from .image import server_router as image_server_router
from .message_improvement import (
    client_router as message_improvement_client_router,
)
from .message_improvement import (
    server_router as message_improvement_server_router,
)
from .message_strength import client_router as message_strength_client_router
from .message_strength import server_router as message_strength_server_router
from .objectives import client_router as objectives_client_router
from .objectives import server_router as objectives_server_router
from .questions import client_router as questions_client_router
from .questions import server_router as questions_server_router
from .standard_group_descriptions import (
    server_router as standard_group_descriptions_server_router,
)
from .title import client_router as title_client_router
from .title import server_router as title_server_router
from .title_description import (
    client_router as title_description_client_router,
)
from .title_description import (
    server_router as title_description_server_router,
)
from .video import client_router as video_client_router
from .video import server_router as video_server_router

client_router = APIRouter(prefix="/tools", tags=["socket-client"])
server_router = APIRouter(prefix="/tools", tags=["socket-server"])

client_router.include_router(document_client_router)
client_router.include_router(title_client_router)
client_router.include_router(title_description_client_router)
client_router.include_router(objectives_client_router)
client_router.include_router(image_client_router)
client_router.include_router(video_client_router)
client_router.include_router(questions_client_router)
client_router.include_router(audio_client_router)
client_router.include_router(feedback_client_router)
client_router.include_router(message_strength_client_router)
client_router.include_router(message_improvement_client_router)

server_router.include_router(document_server_router)
server_router.include_router(title_server_router)
server_router.include_router(title_description_server_router)
server_router.include_router(objectives_server_router)
server_router.include_router(image_server_router)
server_router.include_router(video_server_router)
server_router.include_router(questions_server_router)
server_router.include_router(standard_group_descriptions_server_router)
server_router.include_router(audio_server_router)
server_router.include_router(feedback_server_router)
server_router.include_router(message_strength_server_router)
server_router.include_router(message_improvement_server_router)

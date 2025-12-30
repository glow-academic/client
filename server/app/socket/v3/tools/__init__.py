"""WebSocket tool event handlers."""

from fastapi import APIRouter

from .analysis import client_router as analysis_client_router
from .analysis import server_router as analysis_server_router
from .classification import client_router as classification_client_router
from .classification import server_router as classification_server_router
from .document import client_router as document_client_router
from .document import server_router as document_server_router
from .end_conversation import (
    client_router as end_conversation_client_router,
)
from .end_conversation import (
    server_router as end_conversation_server_router,
)
from .feedback_improvement import (
    client_router as feedback_improvement_client_router,
)
from .feedback_improvement import (
    server_router as feedback_improvement_server_router,
)
from .feedback_strength import (
    client_router as feedback_strength_client_router,
)
from .feedback_strength import (
    server_router as feedback_strength_server_router,
)
from .grade import client_router as grade_client_router
from .grade import server_router as grade_server_router
from .hint import client_router as hint_client_router
from .hint import server_router as hint_server_router
from .image import client_router as image_client_router
from .image import server_router as image_server_router
from .objective import client_router as objective_client_router
from .objective import server_router as objective_server_router
from .question import client_router as question_client_router
from .question import server_router as question_server_router
from .speak import client_router as speak_client_router
from .speak import server_router as speak_server_router
from .standard_group_descriptions import (
    server_router as standard_group_descriptions_server_router,
)
from .statement import client_router as statement_client_router
from .statement import server_router as statement_server_router
from .title import client_router as title_client_router
from .title import server_router as title_server_router
from .video import client_router as video_client_router
from .video import server_router as video_server_router

client_router = APIRouter(prefix="/tools", tags=["socket-client"])
server_router = APIRouter(prefix="/tools", tags=["socket-server"])

client_router.include_router(document_client_router)
client_router.include_router(title_client_router)
client_router.include_router(statement_client_router)
client_router.include_router(objective_client_router)
client_router.include_router(image_client_router)
client_router.include_router(video_client_router)
client_router.include_router(question_client_router)
client_router.include_router(analysis_client_router)
client_router.include_router(grade_client_router)
client_router.include_router(feedback_strength_client_router)
client_router.include_router(feedback_improvement_client_router)
client_router.include_router(speak_client_router)
client_router.include_router(hint_client_router)
client_router.include_router(classification_client_router)
client_router.include_router(end_conversation_client_router)

server_router.include_router(document_server_router)
server_router.include_router(title_server_router)
server_router.include_router(statement_server_router)
server_router.include_router(objective_server_router)
server_router.include_router(image_server_router)
server_router.include_router(video_server_router)
server_router.include_router(question_server_router)
server_router.include_router(standard_group_descriptions_server_router)
server_router.include_router(analysis_server_router)
server_router.include_router(grade_server_router)
server_router.include_router(feedback_strength_server_router)
server_router.include_router(feedback_improvement_server_router)
server_router.include_router(speak_server_router)
server_router.include_router(hint_server_router)
server_router.include_router(classification_server_router)
server_router.include_router(end_conversation_server_router)

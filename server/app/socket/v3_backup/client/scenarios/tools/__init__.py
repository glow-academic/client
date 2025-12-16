"""Scenario tool WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .document import router as document_router
from .image import router as image_router
from .objectives import router as objectives_router
from .questions import router as questions_router
from .statement import router as statement_router
from .video import router as video_router

router = APIRouter(prefix="/tools", tags=["socket-client"])

router.include_router(document_router)
router.include_router(statement_router)
router.include_router(objectives_router)
router.include_router(image_router)
router.include_router(video_router)
router.include_router(questions_router)

"""Voice user WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .delta import router as delta_router
from .speech import router as speech_router
from .start import router as start_router
from .text import router as text_router
from .transcript import router as transcript_router

router = APIRouter(prefix="/user", tags=["socket-client"])

router.include_router(start_router)
router.include_router(delta_router)
router.include_router(transcript_router)
router.include_router(text_router)
router.include_router(speech_router)

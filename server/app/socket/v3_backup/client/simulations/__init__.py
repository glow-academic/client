"""Simulation WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .join import router as join_router
from .leave import router as leave_router
from .text import router as text_router
from .voice import router as voice_router

router = APIRouter(prefix="/simulations", tags=["socket-client"])

router.include_router(join_router)
router.include_router(leave_router)
router.include_router(text_router)
router.include_router(voice_router)


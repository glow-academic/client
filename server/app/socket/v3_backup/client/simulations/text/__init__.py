"""Simulation text WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .end import router as end_router
from .next import router as next_router
from .practice import router as practice_router
from .send import router as send_router
from .start import router as start_router
from .stop import router as stop_router

router = APIRouter(prefix="/simulations/text", tags=["socket-client"])

router.include_router(start_router)
router.include_router(stop_router)
router.include_router(send_router)
router.include_router(next_router)
router.include_router(end_router)
router.include_router(practice_router)


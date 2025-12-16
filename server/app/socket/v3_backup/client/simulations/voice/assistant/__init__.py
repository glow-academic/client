"""Voice assistant WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .delta import router as delta_router
from .done import router as done_router
from .interrupted import router as interrupted_router

router = APIRouter(prefix="/assistant", tags=["socket-client"])

router.include_router(delta_router)
router.include_router(done_router)
router.include_router(interrupted_router)

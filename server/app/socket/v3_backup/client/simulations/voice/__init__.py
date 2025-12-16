"""Voice simulation WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .assistant import router as assistant_router
from .debug import router as debug_router
from .start import router as start_router
from .stop import router as stop_router
from .user import router as user_router

router = APIRouter(prefix="/simulations/voice", tags=["socket-client"])

router.include_router(start_router)
router.include_router(stop_router)
router.include_router(debug_router)
router.include_router(user_router)
router.include_router(assistant_router)

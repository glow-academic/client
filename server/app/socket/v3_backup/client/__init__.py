"""Client-to-server WebSocket event handlers."""

from fastapi import APIRouter

# Import routers from subdirectories
from . import connect, disconnect, log
from . import documents, images, scenarios, simulations, videos

router = APIRouter(prefix="/client", tags=["socket-client"])

# Include lifecycle routers
router.include_router(connect.router)
router.include_router(disconnect.router)

# Include resource routers
router.include_router(simulations.router)
router.include_router(scenarios.router)
router.include_router(documents.router)
router.include_router(videos.router)
router.include_router(images.router)

# Include utility routers
router.include_router(log.router)


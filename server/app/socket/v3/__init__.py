"""Socket v3 API router aggregator - collects all socket API endpoints."""

from fastapi import APIRouter

from . import connect, disconnect, log
from . import documents, images, scenarios, simulations, videos

# Create main router
router = APIRouter(prefix="/socket/v3", tags=["socket"])

# Collect client and server routers separately
client_router = APIRouter(prefix="/client", tags=["socket-client"])
server_router = APIRouter(prefix="/server", tags=["socket-server"])

# Include lifecycle routers
client_router.include_router(connect.client_router)
client_router.include_router(disconnect.client_router)
client_router.include_router(log.client_router)

server_router.include_router(connect.server_router)

# Include resource routers
client_router.include_router(simulations.client_router)
client_router.include_router(scenarios.client_router)
client_router.include_router(documents.client_router)
client_router.include_router(videos.client_router)
client_router.include_router(images.client_router)

server_router.include_router(simulations.server_router)
server_router.include_router(scenarios.server_router)
server_router.include_router(documents.server_router)
server_router.include_router(videos.server_router)
server_router.include_router(images.server_router)

# Include both routers in main router
router.include_router(client_router)
router.include_router(server_router)

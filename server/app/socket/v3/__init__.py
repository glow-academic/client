"""Socket v3 API router aggregator - collects all socket API endpoints."""

from fastapi import APIRouter

from . import (actions, agents, connect, disconnect, evals, log, simulations,
               tools)

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

# Include agent routers
client_router.include_router(agents.client_router)
server_router.include_router(agents.server_router)

# Include tool routers
client_router.include_router(tools.client_router)
server_router.include_router(tools.server_router)

# Include simulation operation routers
client_router.include_router(simulations.client_router)
server_router.include_router(simulations.server_router)

# Include eval operation routers
client_router.include_router(evals.client_router)
server_router.include_router(evals.server_router)

# Include both routers in main router
router.include_router(client_router)
router.include_router(server_router)

"""Socket v4 API router aggregator - collects all socket API endpoints.

This router aggregates all WebSocket v4 event handlers following the agents-style architecture pattern:
- PostgreSQL functions with RETURNS TABLE instead of raw SQL queries
- Composite types in the `types` schema for strongly typed nested structures
- Auto-generated Pydantic models from SQL introspection
- Single SQL file per event with idempotent drop/recreate pattern
- One event per file, one SQL file per event

See `server/app/socket/v4/STANDARDS.md` for complete WebSocket standards.
See `AGENTS.md` for overall architecture principles.
"""

from fastapi import APIRouter

from . import (
    artifacts,
    connect,
    disconnect,
)
from .artifacts import (
    agent,
    document,
    persona,
    rubric,
    scenario,
)
from .attempts import (
    benchmark,
    simulation,
)

# Create main router
router = APIRouter(prefix="/socket/v4", tags=["socket"])

# Collect client and server routers separately
client_router = APIRouter(prefix="/client", tags=["socket-client"])
server_router = APIRouter(prefix="/server", tags=["socket-server"])

# Include lifecycle routers
client_router.include_router(connect.client_router)
client_router.include_router(disconnect.client_router)

server_router.include_router(connect.server_router)

# Include artifacts routers (start, end, error)
client_router.include_router(artifacts.client_router)
server_router.include_router(artifacts.server_router)

# Include artifact routers (scenario, rubric, document, agent, persona)
client_router.include_router(scenario.client_router)
server_router.include_router(scenario.server_router)

client_router.include_router(rubric.client_router)
server_router.include_router(rubric.server_router)

client_router.include_router(document.client_router)
server_router.include_router(document.server_router)

client_router.include_router(agent.client_router)
server_router.include_router(agent.server_router)

client_router.include_router(persona.client_router)
server_router.include_router(persona.server_router)

# Include attempts routers (simulation, benchmark)
client_router.include_router(simulation.client_router)
server_router.include_router(simulation.server_router)

client_router.include_router(benchmark.client_router)
server_router.include_router(benchmark.server_router)

# Include both routers in main router
router.include_router(client_router)
router.include_router(server_router)

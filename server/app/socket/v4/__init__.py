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
    resources,
)
from .artifacts import (
    agent,
    cohort,
    department,
    document,
    eval,
    field,
    model,
    parameter,
    persona,
    profile,
    provider,
    rubric,
    scenario,
    setting,
    tool,
    training_bundle,
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

client_router.include_router(cohort.client_router)
server_router.include_router(cohort.server_router)

client_router.include_router(profile.client_router)
server_router.include_router(profile.server_router)

client_router.include_router(parameter.client_router)
server_router.include_router(parameter.server_router)

client_router.include_router(field.client_router)
server_router.include_router(field.server_router)

client_router.include_router(model.client_router)
server_router.include_router(model.server_router)

client_router.include_router(tool.client_router)
server_router.include_router(tool.server_router)

client_router.include_router(department.client_router)
server_router.include_router(department.server_router)

client_router.include_router(provider.client_router)
server_router.include_router(provider.server_router)

client_router.include_router(eval.client_router)
server_router.include_router(eval.server_router)

client_router.include_router(setting.client_router)
server_router.include_router(setting.server_router)

client_router.include_router(training_bundle.client_router)
server_router.include_router(training_bundle.server_router)

# Include per-resource socket event routers
server_router.include_router(resources.server_router)

# Include both routers in main router
router.include_router(client_router)
router.include_router(server_router)

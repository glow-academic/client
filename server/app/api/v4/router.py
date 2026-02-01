"""V4 API router - DHH-style architecture with SQL files and utility functions.

This router aggregates all API v4 endpoints following the agents-style architecture pattern:
- PostgreSQL functions with RETURNS TABLE instead of raw SQL queries
- Composite types in the `types` schema for strongly typed nested structures
- Auto-generated Pydantic models from SQL introspection
- Single SQL file per route with idempotent drop/recreate pattern

See `server/app/api/v4/STANDARDS.md` for complete API standards.
See `AGENTS.md` for overall architecture principles.
"""
# mypy: ignore-errors

# ============================================================================
# Analytics
# ============================================================================
# ============================================================================
# Imports
# ============================================================================
from fastapi import APIRouter, Depends

from app.api.v4.analytics import router as analytics_router

# ============================================================================
# Artifacts (19 total)
# ============================================================================
from app.api.v4.artifacts.agent import router as agents_router
from app.api.v4.artifacts.auth import router as auth_artifact_router
from app.api.v4.artifacts.cohort import router as cohorts_router
from app.api.v4.artifacts.department import router as departments_router
from app.api.v4.artifacts.document import router as documents_router
from app.api.v4.artifacts.eval import router as evals_router
from app.api.v4.artifacts.field import router as fields_router
from app.api.v4.artifacts.group import router as group_router
from app.api.v4.artifacts.model import router as models_router
from app.api.v4.artifacts.parameter import router as parameters_router
from app.api.v4.artifacts.persona import router as personas_router
from app.api.v4.artifacts.training import router as training_artifact_router
from app.api.v4.artifacts.attempt import router as attempt_artifact_router
from app.api.v4.artifacts.profile import router as profile_router
from app.api.v4.artifacts.provider import router as providers_router
from app.api.v4.artifacts.rubric import router as rubrics_router
from app.api.v4.artifacts.scenario import router as scenarios_router
from app.api.v4.artifacts.setting import router as settings_router
from app.api.v4.artifacts.simulation import router as simulations_router
from app.api.v4.artifacts.tool import router as tools_router

# ============================================================================
# Attempts
# ============================================================================
from app.api.v4.attempts import router as attempts_router

# ============================================================================
# Auth (not available to MCP)
# ============================================================================
from app.api.v4.auth import router as auth_router

# ============================================================================
# Bulk Operations
# ============================================================================
from app.api.v4.bulk import router as bulk_router

# ============================================================================
# Root Level Endpoints
# ============================================================================
from app.api.v4.debug import router as debug_router

# ============================================================================
# Decrypt
# ============================================================================
from app.api.v4.decrypt import router as decrypt_router
from app.api.v4.docs import router as docs_router

# ============================================================================
# Export
# ============================================================================
from app.api.v4.export import router as export_router

# ============================================================================
# Resources
# ============================================================================
from app.api.v4.resources import router as resources_router

# ============================================================================
# Uploads
# ============================================================================
from app.api.v4.uploads import router as uploads_router

# ============================================================================
# Views (READ layer on entry_type tables)
# ============================================================================
from app.api.v4.views import router as views_router
from app.utils.mcp.get_mcp import get_mcp
from app.utils.profile.get_profile_id import get_profile_id
from app.utils.session.get_session_id import get_session_id

# ============================================================================
# Main Router Configuration
# ============================================================================
# Apply router-level dependencies to automatically parse profile ID headers
# This makes profile_id available via request.state.profile_id in all endpoints
router: APIRouter = APIRouter(
    prefix="/api/v4",
    tags=["v4"],
    dependencies=[
        Depends(get_profile_id),
        Depends(get_session_id),
        Depends(get_mcp),
    ],
)

# ============================================================================
# Artifacts (Core Content Resources)
# ============================================================================
router.include_router(personas_router)
router.include_router(scenarios_router)
router.include_router(simulations_router)
router.include_router(documents_router)
router.include_router(departments_router)
router.include_router(cohorts_router)
router.include_router(evals_router)
router.include_router(rubrics_router)
router.include_router(settings_router)
router.include_router(agents_router)
router.include_router(models_router)
router.include_router(providers_router)
router.include_router(parameters_router)
router.include_router(fields_router)
router.include_router(profile_router)
router.include_router(auth_artifact_router)
router.include_router(tools_router)
router.include_router(group_router)
router.include_router(training_artifact_router)
router.include_router(attempt_artifact_router)

# ============================================================================
# Resources
# ============================================================================
router.include_router(resources_router)

# ============================================================================
# Analytics & Dashboard Routes
# ============================================================================
router.include_router(analytics_router)

# ============================================================================
# Views (READ layer on entry_type tables)
# ============================================================================
router.include_router(views_router)

# ============================================================================
# Attempts
# ============================================================================
router.include_router(attempts_router)

# ============================================================================
# Bulk Operations
# ============================================================================
router.include_router(bulk_router)

# ============================================================================
# Decrypt
# ============================================================================
router.include_router(decrypt_router)

# ============================================================================
# Export
# ============================================================================
router.include_router(export_router)

# ============================================================================
# Uploads
# ============================================================================
router.include_router(uploads_router)

# ============================================================================
# Auth (not available to MCP)
# ============================================================================
router.include_router(auth_router)

# ============================================================================
# Root Level Endpoints
# ============================================================================
router.include_router(debug_router)
router.include_router(docs_router)

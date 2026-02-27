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
# Imports
# ============================================================================
from fastapi import APIRouter, Depends

from app.api.v4.artifacts.activity import router as activity_artifact_router

# ============================================================================
# Artifacts (19 total)
# ============================================================================
from app.api.v4.artifacts.agent import router as agents_router
from app.api.v4.artifacts.attempt import router as attempt_artifact_router
from app.api.v4.artifacts.auth import router as auth_artifact_router
from app.api.v4.artifacts.benchmark import router as benchmark_artifact_router
from app.api.v4.artifacts.chat import router as chat_artifact_router
from app.api.v4.artifacts.cohort import router as cohorts_router

# View-based artifact handlers (aggregated data for UI sections)
from app.api.v4.artifacts.dashboard import router as dashboard_artifact_router
from app.api.v4.artifacts.department import router as departments_router
from app.api.v4.artifacts.document import router as documents_router
from app.api.v4.artifacts.eval import router as evals_router
from app.api.v4.artifacts.field import router as fields_router
from app.api.v4.artifacts.group import router as group_router
from app.api.v4.artifacts.health import router as health_artifact_router
from app.api.v4.artifacts.home import router as home_artifact_router
from app.api.v4.artifacts.leaderboard import router as leaderboard_artifact_router
from app.api.v4.artifacts.model import router as models_router
from app.api.v4.artifacts.parameter import router as parameters_router
from app.api.v4.artifacts.persona import router as personas_router
from app.api.v4.artifacts.practice import router as practice_artifact_router
from app.api.v4.artifacts.pricing import router as pricing_artifact_router
from app.api.v4.artifacts.profile import router as profile_router
from app.api.v4.artifacts.provider import router as providers_router
from app.api.v4.artifacts.reports import router as reports_artifact_router
from app.api.v4.artifacts.rubric import router as rubrics_router
from app.api.v4.artifacts.scenario import router as scenarios_router
from app.api.v4.artifacts.session import router as session_router
from app.api.v4.artifacts.setting import router as settings_router
from app.api.v4.artifacts.simulation import router as simulations_router
from app.api.v4.artifacts.test import router as test_artifact_router
from app.api.v4.artifacts.tool import router as tools_router

# ============================================================================
# Auth (not available to MCP)
# ============================================================================
from app.api.v4.auth import router as auth_router

# ============================================================================
# Docs
# ============================================================================
from app.api.v4.docs import router as docs_router

# ============================================================================
# Entries (CRUD layer on entry tables via MVs)
# ============================================================================
from app.api.v4.entries import router as entries_router

# ============================================================================
# Resources
# ============================================================================
from app.api.v4.resources import router as resources_router

# ============================================================================
# Uploads (TUS protocol, download, preview, template)
# ============================================================================
from app.api.v4.uploads import router as uploads_router
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
# Artifacts — all under /api/v4/artifacts/ to match folder structure
# ============================================================================
artifacts_router = APIRouter(prefix="/artifacts", tags=["artifacts"])

# Core content artifacts
artifacts_router.include_router(personas_router)
artifacts_router.include_router(scenarios_router)
artifacts_router.include_router(simulations_router)
artifacts_router.include_router(documents_router)
artifacts_router.include_router(departments_router)
artifacts_router.include_router(cohorts_router)
artifacts_router.include_router(evals_router)
artifacts_router.include_router(rubrics_router)
artifacts_router.include_router(settings_router)
artifacts_router.include_router(agents_router)
artifacts_router.include_router(models_router)
artifacts_router.include_router(providers_router)
artifacts_router.include_router(parameters_router)
artifacts_router.include_router(fields_router)
artifacts_router.include_router(profile_router)
artifacts_router.include_router(auth_artifact_router)
artifacts_router.include_router(tools_router)
artifacts_router.include_router(group_router)
artifacts_router.include_router(session_router)
artifacts_router.include_router(chat_artifact_router)
artifacts_router.include_router(home_artifact_router)
artifacts_router.include_router(practice_artifact_router)
artifacts_router.include_router(attempt_artifact_router)

# View-based artifacts
artifacts_router.include_router(dashboard_artifact_router)
artifacts_router.include_router(reports_artifact_router)
artifacts_router.include_router(leaderboard_artifact_router)
artifacts_router.include_router(pricing_artifact_router)
artifacts_router.include_router(activity_artifact_router)
artifacts_router.include_router(health_artifact_router)
artifacts_router.include_router(benchmark_artifact_router)
artifacts_router.include_router(test_artifact_router)

router.include_router(artifacts_router)

# ============================================================================
# Resources
# ============================================================================
router.include_router(resources_router)


# ============================================================================
# Entries (CRUD layer on entry tables via MVs)
# ============================================================================
router.include_router(entries_router)

# ============================================================================
# Auth (not available to MCP)
# ============================================================================
router.include_router(auth_router)

# ============================================================================
# Uploads (TUS protocol, download, preview, template)
# ============================================================================
router.include_router(uploads_router)

# ============================================================================
# Docs
# ============================================================================
router.include_router(docs_router)

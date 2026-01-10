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
# Batch F: Supporting Resources
# ============================================================================
from fastapi import APIRouter, Depends
from utils.mcp.get_mcp import get_mcp
from utils.profile.get_effective_profile_id import get_effective_profile_id
from utils.profile.get_profile_id import get_profile_id

from app.api.v4.activity import router as activity_router
from app.api.v4.agents import router as agents_router

# ============================================================================
# Batch E: Analytics & Dashboard Routes
# ============================================================================
from app.api.v4.analytics import router as analytics_router
from app.api.v4.attempts import router as attempts_router
from app.api.v4.auth import router as auth_router
from app.api.v4.benchmark import router as benchmark_router
from app.api.v4.cohorts import router as cohorts_router
from app.api.v4.dashboard import router as dashboard_router
from app.api.v4.resources import router as resources_router

# ============================================================================
# Batch C: Secondary Resources (Complete CRUD)
# ============================================================================
from app.api.v4.departments import router as departments_router
from app.api.v4.documents import router as documents_router
from app.api.v4.evals import router as evals_router
from app.api.v4.feedback import router as feedback_router
from app.api.v4.fields import router as fields_router
from app.api.v4.health import router as health_router

# ============================================================================
# Batch G: Utility Routes
# ============================================================================
from app.api.v4.home import router as home_router
from app.api.v4.keys import router as keys_router
from app.api.v4.leaderboard import router as leaderboard_router
from app.api.v4.models import router as models_router
from app.api.v4.parameters import router as parameters_router
from app.api.v4.personas import router as personas_router
from app.api.v4.practice import router as practice_router
from app.api.v4.pricing import router as pricing_router

# ============================================================================
# Batch B: Profile Routes
# ============================================================================
from app.api.v4.profile import router as profile_router
from app.api.v4.prompts import router as prompts_router
from app.api.v4.providers import router as providers_router
from app.api.v4.reports import router as reports_router
from app.api.v4.rubrics import router as rubrics_router

# ============================================================================
# Batch C: Core Content Resources (Complete CRUD)
# ============================================================================
from app.api.v4.scenarios import router as scenarios_router
from app.api.v4.settings import router as settings_router
from app.api.v4.simulations import router as simulations_router
from app.api.v4.staff import router as staff_router
from app.api.v4.uploads import router as uploads_router

# ============================================================================
# Main Router Configuration
# ============================================================================
# Apply router-level dependencies to automatically parse profile ID headers
# This makes profile_id available via request.state.profile_id and
# effective_profile_id available via request.state.effective_profile_id in all endpoints
router: APIRouter = APIRouter(
    prefix="/api/v4",
    tags=["v4"],
    dependencies=[Depends(get_profile_id), Depends(get_effective_profile_id), Depends(get_mcp)],
)

# Batch B: Profile Routes
router.include_router(profile_router)

# Batch C: Core Content Resources (Complete CRUD)
router.include_router(scenarios_router)
router.include_router(simulations_router)
router.include_router(personas_router)

# Batch C: Secondary Resources (Complete CRUD)
router.include_router(auth_router)
router.include_router(departments_router)
router.include_router(cohorts_router)
router.include_router(documents_router)
router.include_router(resources_router)
router.include_router(evals_router)
router.include_router(rubrics_router)
router.include_router(settings_router)

# Batch E: Analytics & Dashboard Routes
router.include_router(analytics_router)
router.include_router(activity_router)
router.include_router(dashboard_router)
router.include_router(reports_router)
router.include_router(leaderboard_router)

# Batch F: Supporting Resources
router.include_router(agents_router)
router.include_router(keys_router)
router.include_router(models_router)
router.include_router(providers_router)
router.include_router(parameters_router)
router.include_router(fields_router)
router.include_router(feedback_router)
router.include_router(health_router)
router.include_router(attempts_router)
router.include_router(prompts_router)
router.include_router(staff_router)

# Batch G: Utility Routes
router.include_router(benchmark_router)
router.include_router(home_router)
router.include_router(practice_router)
router.include_router(pricing_router)
router.include_router(uploads_router)

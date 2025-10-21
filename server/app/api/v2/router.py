"""Main v2 API router."""

from fastapi import APIRouter

from app.api.v2.agents import router as agents_router
from app.api.v2.analytics import router as analytics_router
from app.api.v2.assistant import router as assistant_router
from app.api.v2.attempts import router as attempts_router
from app.api.v2.cohorts import router as cohorts_router
from app.api.v2.dashboard import router as dashboard_router
from app.api.v2.departments import router as departments_router
from app.api.v2.documents import router as documents_router
from app.api.v2.feedback import router as feedback_router
from app.api.v2.home import router as home_router
from app.api.v2.leaderboard import router as leaderboard_router
from app.api.v2.logs import router as logs_router
from app.api.v2.parameters import router as parameters_router
from app.api.v2.personas import router as personas_router
from app.api.v2.practice import router as practice_router
from app.api.v2.pricing import router as pricing_router
from app.api.v2.profile import router as profile_router
from app.api.v2.providers import router as providers_router
from app.api.v2.reports import router as reports_router
from app.api.v2.rubrics import router as rubrics_router
from app.api.v2.scenarios import router as scenarios_router
from app.api.v2.simulations import router as simulations_router

# Create main v2 router
router = APIRouter(prefix="/api/v2")

# Include profile router (unified auth + staff)
router.include_router(profile_router)

# Include analytics utility router (refresh only)
router.include_router(analytics_router)

# Include analytics section routers (6 separate routers)
router.include_router(dashboard_router)
router.include_router(home_router)
router.include_router(practice_router)
router.include_router(leaderboard_router)
router.include_router(reports_router)
router.include_router(pricing_router)

# Include personas router
router.include_router(personas_router)

# Include documents router
router.include_router(documents_router)

# Include scenarios router
router.include_router(scenarios_router)

# Include simulations router
router.include_router(simulations_router)

# Include rubrics router
router.include_router(rubrics_router)

# Include cohorts router
router.include_router(cohorts_router)

# Include providers router
router.include_router(providers_router)

# Include parameters router
router.include_router(parameters_router)

# Include departments router
router.include_router(departments_router, prefix="/departments", tags=["departments"])

# Include agents router
router.include_router(agents_router, prefix="/agents", tags=["agents"])

# Include feedback router
router.include_router(feedback_router, prefix="/feedback", tags=["feedback"])

# Include logs router
router.include_router(logs_router, prefix="/logs", tags=["logs"])

# Include attempts router
router.include_router(attempts_router)

# Include assistant router
router.include_router(assistant_router)

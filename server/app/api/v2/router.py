"""Main v2 API router."""

from app.api.v2.analytics.router import router as analytics_router
from app.api.v2.cohorts import router as cohorts_router
from app.api.v2.documents import router as documents_router
from app.api.v2.personas import router as personas_router
from app.api.v2.rubrics import router as rubrics_router
from app.api.v2.scenarios import router as scenarios_router
from app.api.v2.simulations import router as simulations_router
from app.api.v2.staff import router as staff_router
from fastapi import APIRouter

# Create main v2 router
router = APIRouter(prefix="/api/v2")

# Include analytics router
router.include_router(analytics_router)

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

# Include staff router
router.include_router(staff_router)

# Include cohorts router
router.include_router(cohorts_router)


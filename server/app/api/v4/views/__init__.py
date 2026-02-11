"""Views API router - READ layer on top of entry_type tables.

Views aggregate entries and expose resources for developer templates.
This consolidates home/practice/dashboard/reports into unified views with filter parameters.
"""

from fastapi import APIRouter

from app.api.v4.views.activity import router as activity_router
from app.api.v4.views.analytics import router as analytics_router
from app.api.v4.views.artifacts import router as artifacts_router
from app.api.v4.views.attempt import router as attempt_router
from app.api.v4.views.benchmark import router as benchmark_router
from app.api.v4.views.config import router as config_router
from app.api.v4.views.health import router as health_router
from app.api.v4.views.pricing import router as pricing_router
from app.api.v4.views.training import router as training_router

router = APIRouter(prefix="/views", tags=["views"])

router.include_router(attempt_router)
router.include_router(analytics_router)
router.include_router(pricing_router)
router.include_router(activity_router)
router.include_router(health_router)
router.include_router(benchmark_router)
router.include_router(artifacts_router)
router.include_router(config_router)
router.include_router(training_router)

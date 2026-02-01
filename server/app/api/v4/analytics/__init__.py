"""Analytics v4 API resource router."""

from fastapi import APIRouter

from app.api.v4.analytics.activity import router as activity_router
from app.api.v4.analytics.benchmark import router as benchmark_router
from app.api.v4.analytics.dashboard import router as dashboard_router
from app.api.v4.analytics.health import router as health_router
from app.api.v4.analytics.home import router as home_router
from app.api.v4.analytics.leaderboard import router as leaderboard_router
from app.api.v4.analytics.practice import router as practice_router
from app.api.v4.analytics.pricing import router as pricing_router
from app.api.v4.analytics.refresh import router as refresh_router
from app.api.v4.analytics.reports import router as reports_router

router = APIRouter(prefix="/analytics", tags=["analytics"])

router.include_router(home_router)
router.include_router(reports_router)
router.include_router(activity_router)
router.include_router(dashboard_router)
router.include_router(practice_router)
router.include_router(leaderboard_router)
router.include_router(pricing_router)
router.include_router(benchmark_router)
router.include_router(health_router)
router.include_router(refresh_router)

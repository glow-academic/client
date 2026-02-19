"""Artifacts API router - aggregated data endpoints for UI sections.

Artifacts combine multiple view internals with resource metadata into a single response.
Each artifact endpoint corresponds to a major UI section (dashboard, reports, etc.).
"""

from fastapi import APIRouter

from app.api.v4.artifacts.activity import router as activity_router
from app.api.v4.artifacts.benchmark import router as benchmark_router
from app.api.v4.artifacts.dashboard import router as dashboard_router
from app.api.v4.artifacts.health import router as health_router
from app.api.v4.artifacts.leaderboard import router as leaderboard_router
from app.api.v4.artifacts.pricing import router as pricing_router
from app.api.v4.artifacts.reports import router as reports_router
from app.api.v4.artifacts.suite import router as suite_router
from app.api.v4.artifacts.test import router as test_router

router = APIRouter(prefix="/artifacts", tags=["artifacts"])

router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
router.include_router(reports_router, prefix="/reports", tags=["reports"])
router.include_router(leaderboard_router, prefix="/leaderboard", tags=["leaderboard"])
router.include_router(pricing_router, prefix="/pricing", tags=["pricing"])
router.include_router(activity_router, prefix="/activity", tags=["activity"])
router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(benchmark_router, prefix="/benchmark", tags=["benchmark"])
router.include_router(suite_router, prefix="/suite", tags=["suite"])
router.include_router(test_router, prefix="/test", tags=["test"])

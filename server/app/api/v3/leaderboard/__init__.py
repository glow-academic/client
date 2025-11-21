"""Leaderboard v3 API resource router."""

from app.api.v3.leaderboard.bundle import router as bundle_router
from app.api.v3.leaderboard.cohort import router as cohort_router
from fastapi import APIRouter

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
router.include_router(bundle_router)
router.include_router(cohort_router)

__all__ = ["router"]

"""Leaderboard v4 API resource router."""

from fastapi import APIRouter

from app.api.v4.leaderboard.bundle import router as bundle_router

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
router.include_router(bundle_router)

__all__ = ["router"]

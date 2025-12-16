"""Leaderboard v3 API resource router."""

from fastapi import APIRouter

from app.api.v3.leaderboard.bundle import router as bundle_router

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
router.include_router(bundle_router)

__all__ = ["router"]

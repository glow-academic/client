"""Leaderboard analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.leaderboard.get import router as get_router
from app.api.v4.analytics.leaderboard.list import router as list_router

router = APIRouter(prefix="/leaderboard", tags=["analytics", "leaderboard"])

router.include_router(get_router)
router.include_router(list_router)

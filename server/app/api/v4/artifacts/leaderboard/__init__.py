"""Leaderboard artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.leaderboard.docs import router as docs_router
from app.api.v4.artifacts.leaderboard.get import router as get_router
from app.api.v4.artifacts.leaderboard.refresh import router as refresh_router

router = APIRouter()
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(docs_router)

"""Unified attempt detail router (home + practice via practice: bool)."""

from fastapi import APIRouter

from app.api.v4.artifacts.attempt.archive import router as archive_router
from app.api.v4.artifacts.attempt.get import router as get_router

router = APIRouter(prefix="/attempt", tags=["artifacts", "attempt"])

router.include_router(get_router)
router.include_router(archive_router)

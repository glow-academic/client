"""Unified attempt detail router (home + practice via practice: bool)."""

from fastapi import APIRouter

from app.api.v4.artifacts.attempt.get import router as get_router

router = APIRouter(prefix="/attempt", tags=["artifacts", "attempt"])

router.include_router(get_router)

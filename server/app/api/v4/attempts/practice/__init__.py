"""Practice attempts router."""

from fastapi import APIRouter

from app.api.v4.attempts.practice.get import router as get_router

router = APIRouter(prefix="/practice", tags=["attempts", "practice"])

router.include_router(get_router)

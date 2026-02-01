"""Practice analytics router (MV-based implementation)."""

from fastapi import APIRouter

from app.api.v4.artifacts.practice.attempt import router as attempt_router
from app.api.v4.artifacts.practice.get import router as get_router
from app.api.v4.artifacts.practice.list import router as list_router

router = APIRouter(prefix="/practice", tags=["artifacts", "practice"])

router.include_router(get_router)
router.include_router(list_router)
router.include_router(attempt_router)

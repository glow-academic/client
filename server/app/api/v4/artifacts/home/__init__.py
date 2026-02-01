"""Home analytics router (MV-based implementation)."""

from fastapi import APIRouter

from app.api.v4.artifacts.home.attempt import router as attempt_router
from app.api.v4.artifacts.home.get import router as get_router
from app.api.v4.artifacts.home.list import router as list_router
from app.api.v4.artifacts.home.refresh import router as refresh_router

router = APIRouter(prefix="/home", tags=["artifacts", "home"])

router.include_router(get_router)
router.include_router(list_router)
router.include_router(refresh_router)
router.include_router(attempt_router)

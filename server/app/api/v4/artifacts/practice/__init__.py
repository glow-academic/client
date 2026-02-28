"""Practice artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.practice.export import router as export_router
from app.api.v4.artifacts.practice.get import router as get_router

router = APIRouter(prefix="/practice", tags=["artifacts", "practice"])

router.include_router(get_router)
router.include_router(export_router)

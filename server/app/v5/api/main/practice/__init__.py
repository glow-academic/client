"""Practice artifact router."""

from fastapi import APIRouter

from app.v5.api.main.practice.export import router as export_router
from app.v5.api.main.practice.get import router as get_router

router = APIRouter(prefix="/practice", tags=["artifacts", "practice"])

router.include_router(get_router)
router.include_router(export_router)

"""Home artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.home.export import router as export_router
from app.api.v4.artifacts.home.get import router as get_router

router = APIRouter(prefix="/home", tags=["artifacts", "home"])

router.include_router(get_router)
router.include_router(export_router)

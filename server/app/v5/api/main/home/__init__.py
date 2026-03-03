"""Home artifact router."""

from fastapi import APIRouter

from app.v5.api.main.home.export import router as export_router
from app.v5.api.main.home.get import router as get_router

router = APIRouter(prefix="/home", tags=["artifacts", "home"])

router.include_router(get_router)
router.include_router(export_router)

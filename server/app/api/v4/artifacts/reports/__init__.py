"""Reports artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.reports.export import router as export_router
from app.api.v4.artifacts.reports.get import router as get_router
from app.api.v4.artifacts.reports.refresh import router as refresh_router

router = APIRouter()
router.include_router(export_router)
router.include_router(get_router)
router.include_router(refresh_router)

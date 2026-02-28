"""Dashboard artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.dashboard.docs import router as docs_router
from app.api.v4.artifacts.dashboard.export import router as export_router
from app.api.v4.artifacts.dashboard.get import router as get_router
from app.api.v4.artifacts.dashboard.refresh import router as refresh_router

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)

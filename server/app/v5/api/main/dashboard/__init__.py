"""Dashboard artifact router."""

from fastapi import APIRouter

from app.v5.api.main.dashboard.docs import router as docs_router
from app.v5.api.main.dashboard.export import router as export_router
from app.v5.api.main.dashboard.get import router as get_router
from app.v5.api.main.dashboard.refresh import router as refresh_router

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)

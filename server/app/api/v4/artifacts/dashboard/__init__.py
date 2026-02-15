"""Dashboard artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.dashboard.docs import router as docs_router
from app.api.v4.artifacts.dashboard.footer import router as footer_router
from app.api.v4.artifacts.dashboard.header import router as header_router
from app.api.v4.artifacts.dashboard.primary import router as primary_router
from app.api.v4.artifacts.dashboard.refresh import router as refresh_router
from app.api.v4.artifacts.dashboard.secondary import router as secondary_router

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
router.include_router(header_router)
router.include_router(primary_router)
router.include_router(secondary_router)
router.include_router(footer_router)
router.include_router(refresh_router)
router.include_router(docs_router)

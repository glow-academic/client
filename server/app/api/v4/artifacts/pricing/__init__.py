"""Pricing artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.pricing.docs import router as docs_router
from app.api.v4.artifacts.pricing.export import router as export_router
from app.api.v4.artifacts.pricing.get import router as get_router
from app.api.v4.artifacts.pricing.refresh import router as refresh_router

router = APIRouter(prefix="/pricing", tags=["pricing"])
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)

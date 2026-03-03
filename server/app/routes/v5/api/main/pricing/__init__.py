"""Pricing artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.pricing.docs import router as docs_router
from app.routes.v5.api.main.pricing.export import router as export_router
from app.routes.v5.api.main.pricing.get import router as get_router
from app.routes.v5.api.main.pricing.refresh import router as refresh_router

router = APIRouter(prefix="/pricing", tags=["pricing"])
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)

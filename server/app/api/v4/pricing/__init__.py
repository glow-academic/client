"""Pricing v4 API router."""

from fastapi import APIRouter

from app.api.v4.pricing.analytics import router as analytics_router
from app.api.v4.pricing.detail import router as detail_router
from app.api.v4.pricing.runs import router as runs_router

router = APIRouter(prefix="/pricing", tags=["pricing"])
router.include_router(analytics_router)
router.include_router(runs_router)
router.include_router(detail_router)

__all__ = ["router"]

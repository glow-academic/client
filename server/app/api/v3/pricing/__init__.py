"""Pricing v3 API router."""

from app.api.v3.pricing.analytics import router as analytics_router
from app.api.v3.pricing.runs import router as runs_router
from fastapi import APIRouter

router = APIRouter(prefix="/pricing", tags=["pricing"])
router.include_router(analytics_router)
router.include_router(runs_router)

__all__ = ["router"]

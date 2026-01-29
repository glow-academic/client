"""Pricing analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.pricing.get import router as get_router
from app.api.v4.analytics.pricing.list import router as list_router

router = APIRouter(prefix="/pricing", tags=["analytics", "pricing"])

router.include_router(get_router)
router.include_router(list_router)

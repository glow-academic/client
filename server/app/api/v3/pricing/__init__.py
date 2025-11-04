"""Pricing v3 API router."""

from fastapi import APIRouter

from app.api.v3.pricing.analytics import router as analytics_router

router = APIRouter(prefix="/pricing", tags=["pricing"])

router.include_router(analytics_router)


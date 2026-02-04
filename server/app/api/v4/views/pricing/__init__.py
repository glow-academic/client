"""Pricing views API routes."""

from fastapi import APIRouter

from app.api.v4.views.pricing.run_facts import router as run_facts_router
from app.api.v4.views.pricing.group_summary import router as group_summary_router
from app.api.v4.views.pricing.daily import router as daily_router

router = APIRouter(prefix="/pricing", tags=["views", "pricing"])

router.include_router(run_facts_router, prefix="/run-facts", tags=["run_facts"])
router.include_router(group_summary_router, prefix="/group-summary", tags=["group_summary"])
router.include_router(daily_router, prefix="/daily", tags=["daily"])

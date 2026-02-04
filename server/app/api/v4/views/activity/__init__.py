"""Activity views API routes."""

from fastapi import APIRouter

from app.api.v4.views.activity.session_facts import router as session_facts_router
from app.api.v4.views.activity.daily import router as daily_router
from app.api.v4.views.activity.summary import router as summary_router

router = APIRouter(prefix="/activity", tags=["views", "activity"])

router.include_router(session_facts_router, prefix="/session-facts", tags=["session_facts"])
router.include_router(daily_router, prefix="/daily", tags=["daily"])
router.include_router(summary_router, prefix="/summary", tags=["summary"])

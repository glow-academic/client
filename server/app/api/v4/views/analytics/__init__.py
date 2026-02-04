"""Analytics views API routes."""

from fastapi import APIRouter

from app.api.v4.views.analytics.attempts import router as attempts_router
from app.api.v4.views.analytics.chat_facts import router as chat_facts_router
from app.api.v4.views.analytics.daily_metrics import router as daily_metrics_router
from app.api.v4.views.analytics.profile_metrics import router as profile_metrics_router

router = APIRouter(prefix="/analytics", tags=["views", "analytics"])

router.include_router(attempts_router, prefix="/attempts", tags=["attempts"])
router.include_router(chat_facts_router, prefix="/chat-facts", tags=["chat_facts"])
router.include_router(
    daily_metrics_router,
    prefix="/daily-metrics",
    tags=["daily_metrics"],
)
router.include_router(
    profile_metrics_router,
    prefix="/profile-metrics",
    tags=["profile_metrics"],
)

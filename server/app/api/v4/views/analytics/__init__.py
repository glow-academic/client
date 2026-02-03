"""Analytics views API routes."""

from fastapi import APIRouter

from app.api.v4.views.analytics.attempts import router as attempts_router

router = APIRouter(prefix="/analytics", tags=["views", "analytics"])

router.include_router(attempts_router, prefix="/attempts", tags=["attempts"])

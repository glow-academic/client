"""Analytics v4 API resource router."""

from fastapi import APIRouter

from app.api.v4.analytics.refresh import router as refresh_router
from app.api.v4.analytics.view import router as view_router

router = APIRouter(prefix="/analytics", tags=["analytics"])

router.include_router(refresh_router)
router.include_router(view_router)

__all__ = ["router"]

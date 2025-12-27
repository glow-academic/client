"""Analytics v3 API resource router."""

from fastapi import APIRouter

from app.api.v3.analytics.refresh import router as refresh_router
from app.api.v3.analytics.view import router as view_router

router = APIRouter(prefix="/analytics", tags=["analytics"])

router.include_router(refresh_router)
router.include_router(view_router)

__all__ = ["router"]

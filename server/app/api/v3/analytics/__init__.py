"""Analytics v3 API resource router."""

from app.api.v3.analytics.refresh import router as refresh_router
from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])

router.include_router(refresh_router)

__all__ = ["router"]

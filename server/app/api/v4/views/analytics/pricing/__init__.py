"""Analytics pricing routes."""

from fastapi import APIRouter

from app.api.v4.views.analytics.pricing.get import router as get_router
from app.api.v4.views.analytics.pricing.list import router as list_router

router = APIRouter()

router.include_router(get_router)
router.include_router(list_router)

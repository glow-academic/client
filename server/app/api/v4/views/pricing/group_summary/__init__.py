"""Group summary view router."""

from fastapi import APIRouter

from app.api.v4.views.pricing.group_summary.get import router as get_router

router = APIRouter()
router.include_router(get_router)

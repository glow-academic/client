"""Activity summary view router."""

from fastapi import APIRouter

from app.api.v4.views.activity.summary.get import router as get_router

router = APIRouter()
router.include_router(get_router)

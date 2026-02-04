"""Service hourly view router."""

from fastapi import APIRouter

from app.api.v4.views.health.service_hourly.get import router as get_router

router = APIRouter()
router.include_router(get_router)

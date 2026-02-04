"""Health views API routes."""

from fastapi import APIRouter

from app.api.v4.views.health.service_hourly import router as service_hourly_router
from app.api.v4.views.health.metrics_hourly import router as metrics_hourly_router

router = APIRouter(prefix="/health", tags=["views", "health"])

router.include_router(service_hourly_router, prefix="/service-hourly", tags=["service_hourly"])
router.include_router(metrics_hourly_router, prefix="/metrics-hourly", tags=["metrics_hourly"])

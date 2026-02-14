"""Metric views API routes."""

from fastapi import APIRouter

from app.api.v4.views.metric.list import router as list_router

router = APIRouter(prefix="/metric", tags=["views", "metric"])

router.include_router(list_router, prefix="/list", tags=["list"])

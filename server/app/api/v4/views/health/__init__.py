"""Health views API routes."""

from fastapi import APIRouter

from app.api.v4.views.health.list import router as list_router

router = APIRouter(prefix="/health", tags=["views", "health"])

router.include_router(list_router, prefix="/list", tags=["list"])

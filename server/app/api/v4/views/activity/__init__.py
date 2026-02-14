"""Activity views API routes."""

from fastapi import APIRouter

from app.api.v4.views.activity.list import router as list_router

router = APIRouter(prefix="/activity", tags=["views", "activity"])

router.include_router(list_router, prefix="/list", tags=["list"])

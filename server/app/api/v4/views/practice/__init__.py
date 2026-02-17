"""Practice views router."""

from fastapi import APIRouter

from app.api.v4.views.practice.context import router as context_router

router = APIRouter(prefix="/practice", tags=["views", "practice"])

router.include_router(context_router)

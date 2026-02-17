"""Practice context view router."""

from fastapi import APIRouter

from app.api.v4.views.practice.context.get import router as get_router

router = APIRouter(prefix="/context", tags=["views", "practice", "context"])

router.include_router(get_router)

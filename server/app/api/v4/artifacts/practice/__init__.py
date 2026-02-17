"""Practice artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.practice.get import router as get_router

router = APIRouter(prefix="/practice", tags=["artifacts", "practice"])

router.include_router(get_router)

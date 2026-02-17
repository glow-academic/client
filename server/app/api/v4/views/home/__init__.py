"""Home views router."""

from fastapi import APIRouter

from app.api.v4.views.home.context import router as context_router

router = APIRouter(prefix="/home", tags=["views", "home"])

router.include_router(context_router)

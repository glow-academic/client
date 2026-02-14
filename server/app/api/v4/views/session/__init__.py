"""Session views router."""

from fastapi import APIRouter

from app.api.v4.views.session.list import router as list_router

router = APIRouter(prefix="/session", tags=["views", "session"])

router.include_router(list_router)

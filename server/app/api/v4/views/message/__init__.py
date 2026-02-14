"""Message views router."""

from fastapi import APIRouter

from app.api.v4.views.message.list import router as list_router

router = APIRouter(prefix="/message", tags=["views", "message"])

router.include_router(list_router)

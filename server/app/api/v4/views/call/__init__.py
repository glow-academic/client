"""Call views router."""

from fastapi import APIRouter

from app.api.v4.views.call.list import router as list_router

router = APIRouter(prefix="/call", tags=["views", "call"])

router.include_router(list_router)

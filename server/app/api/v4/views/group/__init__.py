"""Group views router."""

from fastapi import APIRouter

from app.api.v4.views.group.list import router as list_router

router = APIRouter(prefix="/group", tags=["views", "group"])

router.include_router(list_router)

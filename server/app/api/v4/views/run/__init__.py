"""Run views router."""

from fastapi import APIRouter

from app.api.v4.views.run.list import router as list_router

router = APIRouter(prefix="/run", tags=["views", "run"])

router.include_router(list_router)

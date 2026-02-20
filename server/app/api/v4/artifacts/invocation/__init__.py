"""Invocation artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.invocation.draft import router as draft_router
from app.api.v4.artifacts.invocation.get import router as get_router

router = APIRouter(prefix="/invocation", tags=["invocation"])
router.include_router(get_router)
router.include_router(draft_router)

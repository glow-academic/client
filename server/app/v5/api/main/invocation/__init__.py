"""Invocation artifact router."""

from fastapi import APIRouter

from app.v5.api.main.invocation.draft import router as draft_router
from app.v5.api.main.invocation.get import router as get_router

router = APIRouter(prefix="/invocation", tags=["invocation"])
router.include_router(get_router)
router.include_router(draft_router)

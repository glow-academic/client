"""Feedback resource router."""

from fastapi import APIRouter

from app.api.v4.feedback.create import router as create_router
from app.api.v4.feedback.list import router as list_router
from app.api.v4.feedback.resolve import router as resolve_router

router = APIRouter(prefix="/feedback", tags=["feedback"])

# Include endpoint routers
router.include_router(create_router)
router.include_router(list_router)
router.include_router(resolve_router)

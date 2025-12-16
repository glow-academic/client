"""Feedback resource router."""

from fastapi import APIRouter

from app.api.v3.feedback.create import router as create_router

router = APIRouter(prefix="/feedback", tags=["feedback"])

# Include endpoint routers
router.include_router(create_router)

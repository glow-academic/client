"""Feedback resource router."""

from fastapi import APIRouter

from app.api.v3.feedback.bulk_delete import router as bulk_delete_router
from app.api.v3.feedback.create import router as create_router
from app.api.v3.feedback.list import router as list_router

router = APIRouter(prefix="/feedback", tags=["feedback"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(create_router)
router.include_router(bulk_delete_router)


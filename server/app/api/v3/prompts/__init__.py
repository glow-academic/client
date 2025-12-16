"""Prompts v3 API endpoints."""

from fastapi import APIRouter

from .delete import router as delete_router

router = APIRouter(prefix="/prompts", tags=["prompts"])

# Include endpoint routers
router.include_router(delete_router)


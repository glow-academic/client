"""Scenarios resource endpoints - v4 API."""

from fastapi import APIRouter

from app.api.v4.resources.scenarios.get import router as get_router
from app.api.v4.resources.scenarios.search import router as search_router

router = APIRouter()

# Include all scenarios resource routers
router.include_router(get_router)
router.include_router(search_router)

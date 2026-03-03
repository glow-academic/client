"""Modalities resource endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.resources.modalities.get import router as get_router
from app.routes.v5.api.resources.modalities.search import (
    router as search_router,
)

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)

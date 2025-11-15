"""Schema v3 API routes."""

from fastapi import APIRouter

from .list import router as list_router
from .query import router as query_router

router = APIRouter(prefix="/schema", tags=["schema"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(query_router)

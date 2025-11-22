"""Prompts resource router."""

from fastapi import APIRouter

from app.api.v3.prompts.create import router as create_router
from app.api.v3.prompts.delete import router as delete_router
from app.api.v3.prompts.detail import router as detail_router
from app.api.v3.prompts.detail_default import router as detail_default_router
from app.api.v3.prompts.list import router as list_router
from app.api.v3.prompts.update import router as update_router

router = APIRouter(prefix="/prompts", tags=["prompts"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)


"""Agents resource router."""

from fastapi import APIRouter

from app.api.v3.agents.create import router as create_router
from app.api.v3.agents.delete import router as delete_router
from app.api.v3.agents.delete_prompt import router as delete_prompt_router
from app.api.v3.agents.detail import router as detail_router
from app.api.v3.agents.detail_default import router as detail_default_router
from app.api.v3.agents.duplicate import router as duplicate_router
from app.api.v3.agents.list import router as list_router
from app.api.v3.agents.update import router as update_router

router = APIRouter(prefix="/agents", tags=["agents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(delete_prompt_router)


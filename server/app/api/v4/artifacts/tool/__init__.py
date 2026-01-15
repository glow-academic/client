"""Tool v4 router."""

from app.api.v4.artifacts.tool.delete import router as delete_router
from app.api.v4.artifacts.tool.draft import router as draft_router
from app.api.v4.artifacts.tool.duplicate import router as duplicate_router
from app.api.v4.artifacts.tool.get import router as get_router
from app.api.v4.artifacts.tool.list import router as list_router
from app.api.v4.artifacts.tool.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/tools", tags=["tools"])

# Include all endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)

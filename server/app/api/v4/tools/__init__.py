"""Tools v4 router."""

from fastapi import APIRouter

from app.api.v4.tools.delete import router as delete_router
from app.api.v4.tools.draft import router as draft_router
from app.api.v4.tools.duplicate import router as duplicate_router
from app.api.v4.tools.get import router as get_router
from app.api.v4.tools.list import router as list_router
from app.api.v4.tools.save import router as save_router

router = APIRouter(prefix="/tools", tags=["tools"])

# Include all tool endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)

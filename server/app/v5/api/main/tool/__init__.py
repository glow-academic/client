"""Tool v4 router."""

from fastapi import APIRouter

from app.v5.api.main.tool.delete import router as delete_router
from app.v5.api.main.tool.docs import router as docs_router
from app.v5.api.main.tool.draft import router as draft_router
from app.v5.api.main.tool.duplicate import router as duplicate_router
from app.v5.api.main.tool.get import router as get_router
from app.v5.api.main.tool.list import router as list_router
from app.v5.api.main.tool.save import router as save_router

router = APIRouter(prefix="/tools", tags=["tools"])

# Include all endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)

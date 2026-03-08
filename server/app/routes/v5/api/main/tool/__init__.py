"""Tool v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.tool.create import router as create_router
from app.routes.v5.api.main.tool.delete import router as delete_router
from app.routes.v5.api.main.tool.docs import router as docs_router
from app.routes.v5.api.main.tool.draft import router as draft_router
from app.routes.v5.api.main.tool.duplicate import router as duplicate_router
from app.routes.v5.api.main.tool.get import router as get_router
from app.routes.v5.api.main.tool.save import router as save_router
from app.routes.v5.api.main.tool.search import router as search_router
from app.routes.v5.api.main.tool.update import router as update_router

router = APIRouter(prefix="/tools", tags=["tools"])

# Include all endpoint routers
router.include_router(search_router)
router.include_router(get_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)

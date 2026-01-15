"""Document v4 router."""

from app.api.v4.artifacts.document.delete import router as delete_router
from app.api.v4.artifacts.document.draft import router as draft_router
from app.api.v4.artifacts.document.duplicate import router as duplicate_router
from app.api.v4.artifacts.document.get import router as get_router
from app.api.v4.artifacts.document.list import router as list_router
from app.api.v4.artifacts.document.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/documents", tags=["documents"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)

"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.field.delete import router as delete_router
from app.api.v4.artifacts.field.docs import router as docs_router
from app.api.v4.artifacts.field.draft import router as draft_router
from app.api.v4.artifacts.field.duplicate import router as duplicate_router
from app.api.v4.artifacts.field.get import router as get_router
from app.api.v4.artifacts.field.list import router as list_router
from app.api.v4.artifacts.field.save import router as save_router

router = APIRouter(prefix="/fields", tags=["fields"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)

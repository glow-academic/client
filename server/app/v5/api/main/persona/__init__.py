"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.v5.api.main.persona.delete import router as delete_router
from app.v5.api.main.persona.docs import router as docs_router
from app.v5.api.main.persona.draft import router as draft_router
from app.v5.api.main.persona.duplicate import router as duplicate_router
from app.v5.api.main.persona.export import router as export_router
from app.v5.api.main.persona.get import router as get_router
from app.v5.api.main.persona.list import router as list_router
from app.v5.api.main.persona.save import router as save_router

router = APIRouter(prefix="/personas", tags=["personas"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)
router.include_router(export_router)

"""Document bulk operations router."""

from fastapi import APIRouter

from app.api.v4.bulk.document.delete import router as delete_router
from app.api.v4.bulk.document.process import router as process_router
from app.api.v4.bulk.document.save import router as save_router
from app.api.v4.bulk.document.search import router as search_router

router = APIRouter(prefix="/document", tags=["bulk", "document"])

router.include_router(process_router)
router.include_router(search_router)
router.include_router(save_router)
router.include_router(delete_router)

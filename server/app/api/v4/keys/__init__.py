"""Keys resource router."""

from fastapi import APIRouter

from app.api.v4.keys.create import router as create_router
from app.api.v4.keys.decrypt import router as decrypt_router
from app.api.v4.keys.delete import router as delete_router
from app.api.v4.keys.detail import router as detail_router
from app.api.v4.keys.list import router as list_router
from app.api.v4.keys.new import router as new_router
from app.api.v4.keys.update import router as update_router

router = APIRouter(prefix="/keys", tags=["keys"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(decrypt_router)

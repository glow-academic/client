"""Keys resource router."""

from fastapi import APIRouter

from app.api.v3.keys.create import router as create_router
from app.api.v3.keys.decrypt_key import router as decrypt_key_router
from app.api.v3.keys.detail import router as detail_router
from app.api.v3.keys.list import router as list_router

router = APIRouter(prefix="/keys", tags=["keys"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(create_router)
router.include_router(decrypt_key_router)


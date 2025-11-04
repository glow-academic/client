"""Providers resource router."""

from app.api.v3.providers.create import router as create_router
from app.api.v3.providers.decrypt_key import router as decrypt_key_router
from app.api.v3.providers.delete import router as delete_router
from app.api.v3.providers.detail import router as detail_router
from app.api.v3.providers.duplicate import router as duplicate_router
from app.api.v3.providers.list import router as list_router
from app.api.v3.providers.models import router as models_router
from app.api.v3.providers.update import router as update_router
from fastapi import APIRouter

router = APIRouter(prefix="/providers", tags=["providers"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(duplicate_router)
router.include_router(decrypt_key_router)
router.include_router(models_router)


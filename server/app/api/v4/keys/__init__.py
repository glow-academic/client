"""Keys resource router - internal only (for Settings integration)."""

from fastapi import APIRouter

from app.api.v4.keys.decrypt import router as decrypt_router

router = APIRouter(prefix="/keys", tags=["keys"])

# Include only internal endpoint routers (decrypt for Settings)
router.include_router(decrypt_router)

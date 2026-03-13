"""Root router — collects all top-level route modules."""

import platform
import sys

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.routes.authorize import router as authorize_router
from app.routes.discovery import router as discovery_router
from app.routes.health import router as health_router
from app.routes.jwks import router as jwks_router
from app.routes.token import router as token_router
from app.routes.userinfo import router as userinfo_router
from app.routes.v5 import router as v5_router
from app.routes.well_known import router as well_known_router

router = APIRouter()

router.include_router(v5_router)
router.include_router(health_router)
router.include_router(well_known_router)

# Default IdP — OIDC endpoints under /default-idp
default_idp_router = APIRouter(prefix="/default-idp", tags=["default-idp"])
default_idp_router.include_router(jwks_router)
default_idp_router.include_router(discovery_router)
default_idp_router.include_router(authorize_router)
default_idp_router.include_router(token_router)
default_idp_router.include_router(userinfo_router)
router.include_router(default_idp_router)


@router.get("/")
async def root_info() -> JSONResponse:
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": getattr(
            sys.modules.get("fastapi"), "__version__", "unknown"
        ),
    }
    return JSONResponse(content={"server_info": info})

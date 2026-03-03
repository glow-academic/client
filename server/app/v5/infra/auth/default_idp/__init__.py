"""Default OIDC Identity Provider router."""

from fastapi import APIRouter

from . import jwks, oidc

router = APIRouter(prefix="/default-idp", tags=["default-idp"])

# Include OIDC endpoints (/.well-known/openid-configuration, /authorize, /token, /userinfo)
router.include_router(oidc.router)


# Include JWKS endpoint
@router.get("/jwks")
async def jwks_endpoint():
    """JWKS endpoint for public key exposure."""
    from .jwks import get_jwks

    return get_jwks()

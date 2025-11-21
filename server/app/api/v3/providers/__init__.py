"""Providers resource router - empty (providers managed via models endpoints)."""

from fastapi import APIRouter

router = APIRouter(prefix="/providers", tags=["providers"])

# No endpoints - provider_mapping included in models endpoints per DHH principles

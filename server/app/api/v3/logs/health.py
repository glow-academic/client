"""Health check endpoint - v3 API following DHH principles."""

import os
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.health import HealthResponse
from app.services.health_service import HealthService
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_system_health(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HealthResponse:
    """
    Comprehensive system health check endpoint.
    Tests all 9 system components with real functionality checks.
    No authentication required (for monitoring tools).
    """
    # Get origin from environment or use default
    origin = os.getenv("ORIGIN", "http://localhost:3000")
    
    service = HealthService(conn)
    return await service.get_system_health(origin=origin)


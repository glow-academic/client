"""Profile authorize emulation endpoint - check if emulation is authorized."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

router = APIRouter()


class AuthorizeEmulationRequest(BaseModel):
    """Request to authorize emulation."""

    requesterProfileId: str
    targetProfileId: str


class AuthorizeEmulationResponse(BaseModel):
    """Response indicating if emulation is allowed."""

    allowed: bool
    reason: str | None = None


@router.post("/authorize-emulation")
async def authorize_emulation(
    request: AuthorizeEmulationRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthorizeEmulationResponse:
    """Check if emulation is authorized."""
    # Check if trying to emulate self
    if request.requesterProfileId == request.targetProfileId:
        return AuthorizeEmulationResponse(allowed=True, reason=None)

    # Get simulatable profiles for the requester
    simulatable_sql = load_sql("sql/v3/profile/get_simulatable_profiles_combined.sql")
    simulatable_rows = await conn.fetch(simulatable_sql, request.requesterProfileId)

    # Check if target is in the list
    target_ids = {str(row["id"]) for row in simulatable_rows}

    if request.targetProfileId in target_ids:
        return AuthorizeEmulationResponse(allowed=True, reason=None)
    else:
        return AuthorizeEmulationResponse(
            allowed=False, reason="You do not have permission to emulate this profile"
        )


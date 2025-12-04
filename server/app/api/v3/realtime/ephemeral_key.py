"""Generate OpenAI ephemeral keys for Realtime API."""

import os
from typing import Annotated, Any

import asyncpg  # type: ignore
import httpx  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter()


class EphemeralKeyRequest(BaseModel):
    """Request to generate ephemeral key."""

    profileId: str


class EphemeralKeyResponse(BaseModel):
    """Response with ephemeral key."""

    success: bool
    message: str
    ephemeral_key: str | None = None
    expires_in: int = 3600


async def _generate_ephemeral_key_internal() -> tuple[str, int]:
    """Internal function to generate ephemeral key using OpenAI REST API.
    
    Returns:
        Tuple of (ephemeral_key, expires_in)
    """
    # Get OpenAI API key from environment
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")

    # Use direct REST API call (OpenAI SDK doesn't support this endpoint yet)
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "session": {
                    "type": "realtime",
                    "model": "gpt-realtime",
                }
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        ephemeral_key = data.get("value")
        expires_in = data.get("expires_in", 3600)
        
        if not ephemeral_key:
            raise ValueError("No ephemeral key in response")
        
        return ephemeral_key, expires_in


@router.post("/ephemeral-key", response_model=EphemeralKeyResponse)
async def generate_ephemeral_key(
    request: EphemeralKeyRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EphemeralKeyResponse:
    """Generate OpenAI ephemeral key for Realtime API.

    Server-side only - never expose OpenAI API key to frontend.
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        ephemeral_key, expires_in = await _generate_ephemeral_key_internal()
        
        logger.info(f"Generated ephemeral key (expires in {expires_in}s)")
        
        return EphemeralKeyResponse(
            success=True,
            message="Ephemeral key generated successfully",
            ephemeral_key=ephemeral_key,
            expires_in=expires_in,
        )

    except Exception as e:
        logger.error(f"Error generating ephemeral key: {e}", exc_info=True)
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_ephemeral_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        # This will never be reached as handle_route_error raises
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate ephemeral key: {str(e)}",
        )


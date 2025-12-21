"""Auth sync endpoint - triggers Keycloak sync for identity providers."""

import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.main import get_internal_sio, get_pool
from app.utils.activity.audit import audit_activity


class SyncKeycloakRequest(BaseModel):
    """Request to sync Keycloak identity providers."""

    department_id: str | None = None  # Optional department ID to sync specific department


class SyncKeycloakResponse(BaseModel):
    """Response from Keycloak sync trigger."""

    success: bool
    message: str
    department_id: str | None = None


router = APIRouter()
internal_sio = get_internal_sio()


@router.post(
    "/sync",
    response_model=SyncKeycloakResponse,
    dependencies=[
        audit_activity(
            "auth.sync",
            "{{ actor.name }} triggered Keycloak sync",
        )
    ],
)
async def sync_keycloak(
    request: SyncKeycloakRequest,
    http_request: Request,
) -> SyncKeycloakResponse:
    """Trigger Keycloak sync to update identity providers from database.
    
    This endpoint triggers the Keycloak sync process which:
    - Creates/updates department realms
    - Syncs identity providers (Microsoft, Google, etc.) with credentials from database
    - Updates client configurations
    
    Args:
        request: Optional department_id to sync specific department, or None to sync all
        http_request: FastAPI request object
        
    Returns:
        SyncKeycloakResponse with success status and message
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        department_id = request.department_id
        
        # For local dev, ensure master realm SSL requirement is set to NONE in database
        # This must be done before triggering sync to avoid HTTPS errors
        origin_check = os.getenv("ORIGIN", "http://localhost:3000")
        is_local_dev = "localhost" in origin_check.lower()
        
        pool = get_pool()
        if is_local_dev and pool:
            try:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE keycloak.realm SET ssl_required = 'NONE' WHERE name = 'master'"
                    )
            except Exception:
                # Non-blocking - continue even if database update fails
                pass
        
        # Trigger sync via internal event system
        # The sync handler will ensure glow-client exists in master realm
        await internal_sio.emit(
            "keycloak_sync",
            {"department_id": department_id} if department_id else {},
        )
        
        if department_id:
            message = f"Keycloak sync triggered for department {department_id}"
        else:
            message = "Keycloak sync triggered for all departments"
        
        return SyncKeycloakResponse(
            success=True,
            message=message,
            department_id=department_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        from app.utils.error_handler import handle_route_error
        
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="sync_keycloak",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger Keycloak sync: {str(e)}",
        )


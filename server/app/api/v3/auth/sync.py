"""Auth sync endpoint - triggers Keycloak sync for identity providers."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.infra.activity.audit import audit_activity
from app.infra.auth.keycloak_sync import perform_keycloak_sync


class SyncKeycloakRequest(BaseModel):
    """Request to sync Keycloak identity providers."""

    department_id: str | None = (
        None  # Optional department ID to sync specific department
    )


class SyncKeycloakResponse(BaseModel):
    """Response from Keycloak sync trigger."""

    success: bool
    message: str
    department_id: str | None = None
    error: str | None = None


router = APIRouter()


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

    This endpoint performs the Keycloak sync process synchronously and returns
    the actual result. The sync process:
    - Creates/updates department realms
    - Syncs identity providers (Microsoft, Google, etc.) with credentials from database
    - Updates client configurations

    Args:
        request: Optional department_id to sync specific department, or None to sync all
        http_request: FastAPI request object

    Returns:
        SyncKeycloakResponse with success status, message, and optional error details
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Perform sync directly and get result
        result = await perform_keycloak_sync(department_id=request.department_id)

        # Return response based on result
        if result.success:
            return SyncKeycloakResponse(
                success=True,
                message=result.message,
                department_id=result.department_id,
            )
        else:
            # Sync failed - return error response with error details
            return SyncKeycloakResponse(
                success=False,
                message=result.message,
                department_id=result.department_id,
                error=result.error,
            )
    except HTTPException:
        raise
    except Exception as e:
        from utils.error_handler import handle_route_error

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

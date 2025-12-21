"""Keycloak sync utility - synchronous sync function that returns success/failure."""

import asyncio
from dataclasses import dataclass

from app.socket.v3.actions.keycloak import sync_keycloak
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@dataclass
class KeycloakSyncResult:
    """Result of a Keycloak sync operation."""

    success: bool
    message: str
    department_id: str | None = None
    error: str | None = None


async def perform_keycloak_sync(
    department_id: str | None = None,
) -> KeycloakSyncResult:
    """Perform Keycloak sync and return result.

    This is a wrapper around sync_keycloak() that catches exceptions
    and returns a structured result. It also checks preconditions like
    database pool availability and Keycloak connectivity.

    Args:
        department_id: Optional department ID to sync. If None, syncs all active departments.

    Returns:
        KeycloakSyncResult with success status, message, and optional error details
    """
    from app.main import get_pool

    # Check database pool availability
    pool = get_pool()
    if not pool:
        error_msg = "Database pool not available"
        logger.warning(error_msg)
        return KeycloakSyncResult(
            success=False,
            message=error_msg,
            department_id=department_id,
            error=error_msg,
        )

    try:
        # Check if Keycloak is available BEFORE attempting sync
        # Note: Keycloak might return 403 "HTTPS required" before sync disables SSL requirement
        # This is expected and sync will fix it, so we proceed anyway
        from app.utils.health import check_keycloak

        keycloak_check = await check_keycloak()
        # Only fail if Keycloak is completely unavailable (connection error, not 403 HTTPS required)
        if not keycloak_check.ok and "HTTPS required" not in keycloak_check.error:
            error_msg = f"Keycloak is not available: {keycloak_check.error}"
            logger.warning(error_msg)
            return KeycloakSyncResult(
                success=False,
                message=error_msg,
                department_id=department_id,
                error=keycloak_check.error,
            )

        # Call the actual sync function
        # Note: sync_keycloak() catches exceptions internally and logs warnings,
        # but we wrap it to catch any unexpected exceptions
        # Also note: sync_keycloak() may return early if Keycloak admin connection fails
        # We need to verify sync actually completed by checking if Keycloak is accessible
        await sync_keycloak(department_id=department_id)

        # Verify Keycloak is accessible after sync
        # Wait a moment for any async operations to complete
        await asyncio.sleep(1)

        keycloak_check_after = await check_keycloak()
        # After sync, Keycloak should be accessible (200 OK, not 403 HTTPS required)
        if not keycloak_check_after.ok:
            # If still getting HTTPS required, sync didn't complete successfully
            if (
                "HTTPS required" in keycloak_check_after.error
                or keycloak_check_after.error == "status=403"
            ):
                error_msg = "Keycloak sync did not complete: SSL requirement not disabled (Keycloak may need more time to pick up database changes)"
                logger.warning(error_msg)
                return KeycloakSyncResult(
                    success=False,
                    message=error_msg,
                    department_id=department_id,
                    error=keycloak_check_after.error,
                )
            else:
                error_msg = f"Keycloak sync completed but Keycloak became unhealthy: {keycloak_check_after.error}"
                logger.warning(error_msg)
                return KeycloakSyncResult(
                    success=False,
                    message=error_msg,
                    department_id=department_id,
                    error=keycloak_check_after.error,
                )

        # If we get here, sync completed successfully
        if department_id:
            message = (
                f"Keycloak sync completed successfully for department {department_id}"
            )
        else:
            message = "Keycloak sync completed successfully for all departments"

        return KeycloakSyncResult(
            success=True,
            message=message,
            department_id=department_id,
        )
    except Exception as e:
        # Log the error but return a result instead of raising
        error_msg = str(e)
        logger.error(f"Keycloak sync failed: {error_msg}", exc_info=True)

        if department_id:
            message = (
                f"Keycloak sync failed for department {department_id}: {error_msg}"
            )
        else:
            message = f"Keycloak sync failed: {error_msg}"

        return KeycloakSyncResult(
            success=False,
            message=message,
            department_id=department_id,
            error=error_msg,
        )

"""System initialization endpoint — Keycloak sync."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/init")
async def init_system() -> JSONResponse:
    from app.infra.identity.keycloak_sync import perform_keycloak_sync
    from app.utils.logging.db_logger import get_logger

    logger = get_logger("app.main")

    init_messages: list[str] = []
    init_errors: list[str] = []

    try:
        result = await perform_keycloak_sync(department_id=None)

        if result.success:
            init_messages.append(result.message)
            logger.info(f"Keycloak sync: {result.message}")
        else:
            init_errors.append(result.message)
            logger.error(f"Keycloak sync failed: {result.message}")

        if result.success:
            return JSONResponse(
                content={
                    "success": True,
                    "message": "; ".join(init_messages),
                    "warnings": init_errors if init_errors else None,
                    "error": None,
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "; ".join(init_errors),
                    "warnings": init_messages if init_messages else None,
                    "error": result.error,
                },
            )
    except Exception as e:
        logger.error(f"Error during system initialization: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Failed to initialize system: {str(e)}",
                "error": str(e),
            },
        )

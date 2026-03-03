"""System initialization endpoint — SQL compilation + Keycloak sync."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.globals import expire_all_connections

router = APIRouter()


async def _compile_sql_types() -> tuple[bool, str]:
    try:
        from app.sql.compile_types import compile_sql_types

        success, message = await compile_sql_types()
        return success, message
    except Exception as e:
        return False, f"Error running SQL compilation: {str(e)}"


@router.post("/init")
async def init_system() -> JSONResponse:
    from app.v5.infra.auth.keycloak_sync import perform_keycloak_sync
    from app.utils.logging.db_logger import get_logger

    logger = get_logger("app.main")

    init_messages: list[str] = []
    init_errors: list[str] = []

    try:
        sql_success, sql_message = await _compile_sql_types()
        if sql_success:
            init_messages.append(sql_message)
            logger.info(f"SQL compilation: {sql_message}")
            await expire_all_connections()
        else:
            init_errors.append(sql_message)
            logger.warning(f"SQL compilation: {sql_message}")

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

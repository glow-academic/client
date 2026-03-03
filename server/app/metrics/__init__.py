"""Metrics infrastructure utilities."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/metrics")
async def metrics_snapshot() -> JSONResponse:
    from app.metrics.collector import log_metrics_snapshot

    try:
        await log_metrics_snapshot()
        return JSONResponse(
            content={"success": True, "message": "Metrics snapshot logged"}
        )
    except Exception as e:
        from app.utils.logging.db_logger import get_logger

        logger = get_logger("app.main")
        logger.error(f"Error logging metrics snapshot: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Failed to log metrics snapshot: {str(e)}",
            },
        )

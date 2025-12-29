"""Handler for rubric_tool_standard_group_descriptions WebSocket event."""

import uuid
from typing import Any, cast

from app.main import get_internal_sio, get_pool, sio
from app.sql.types import (IUpdateStandardDescriptionsV3Description,
                           UpdateStandardDescriptionsApiRequest,
                           UpdateStandardDescriptionsSqlParams,
                           UpdateStandardDescriptionsSqlRow)
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.cache.invalidate_tags import invalidate_tags
from utils.logging.db_logger import get_logger
from utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/rubrics/update_standard_descriptions_complete.sql"


class StandardGroupDescriptionsToolCompletePayload(BaseModel):
    """Response indicating standard group descriptions tool completed successfully."""

    success: bool
    rubric_id: str
    updated_count: int
    trace_id: str
    message: str | None = None
    descriptions: list[dict[str, Any]] | None = (
        None  # Array of {standard_group_id, standard_id, description}
    )


class StandardGroupDescriptionsToolErrorPayload(BaseModel):
    """Response indicating an error occurred in standard group descriptions tool."""

    success: bool
    message: str
    trace_id: str


async def standard_group_descriptions_tool_complete(
    payload: StandardGroupDescriptionsToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[rubric_tool_standard_group_descriptions_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"rubric_id={payload.rubric_id}, updated_count={payload.updated_count}"
    )
    await sio.emit(
        "rubrics_tools_standard_group_descriptions_complete",
        payload.model_dump(),
        room=room,
    )
    logger.info(
        f"[rubric_tool_standard_group_descriptions_complete] Emitted to room={room}"
    )


async def standard_group_descriptions_tool_error(
    payload: StandardGroupDescriptionsToolErrorPayload, room: str
) -> None:
    await sio.emit(
        "rubrics_tools_standard_group_descriptions_error",
        payload.model_dump(),
        room=room,
    )


async def _rubric_tool_standard_group_descriptions_impl(
    sid: str, data: UpdateStandardDescriptionsApiRequest, profile_id: uuid.UUID, trace_id: str | None = None
) -> None:
    """Internal implementation for standard group descriptions update."""
    logger.info(
        f"[rubric_tool_standard_group_descriptions] Handler received event: sid={sid}, "
        f"rubric_id={data.rubric_id}, trace_id={trace_id or 'unknown'}"
    )

    pool = get_pool()

    if not pool:
        await standard_group_descriptions_tool_error(
            StandardGroupDescriptionsToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id or "unknown",
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            # Use execute_sql_typed() - auto-detects function
            # data.descriptions is already a list[IUpdateStandardDescriptionsV3Description] after validation
            params = UpdateStandardDescriptionsSqlParams(
                rubric_id=data.rubric_id,
                descriptions=data.descriptions,
                profile_id=profile_id
            )
            result = cast(
                UpdateStandardDescriptionsSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or result.updated_count is None:
                await standard_group_descriptions_tool_error(
                    StandardGroupDescriptionsToolErrorPayload(
                        success=False,
                        message="Failed to update standard descriptions",
                        trace_id=trace_id or "unknown",
                    ),
                    room=sid,
                )
                return

            updated_count = result.updated_count

            logger.info(
                f"✓ Updated {updated_count} standard descriptions "
                f"(rubric_id={data.rubric_id}, trace_id={trace_id})"
            )

            # Invalidate rubrics cache
            await invalidate_tags(["rubrics", f"rubric:{str(data.rubric_id)}"])

            await standard_group_descriptions_tool_complete(
                StandardGroupDescriptionsToolCompletePayload(
                    success=True,
                    rubric_id=str(data.rubric_id),
                    updated_count=updated_count,
                    trace_id=trace_id or "unknown",
                    message=f"Updated {updated_count} standard descriptions successfully",
                    descriptions=[desc.model_dump() for desc in data.descriptions],
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in rubric_tool_standard_group_descriptions for {sid}: {str(e)}",
            exc_info=True,
        )
        await standard_group_descriptions_tool_error(
            StandardGroupDescriptionsToolErrorPayload(
                success=False, message=str(e), trace_id=trace_id or "unknown"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def rubric_tool_standard_group_descriptions(
    sid: str, data: dict[str, Any]
) -> None:
    """Handle standard group descriptions update event from rubric generation tool (client-to-server)."""
    try:
        # Extract profile_id and trace_id before validation (not in ApiRequest)
        profile_id_str = data.get("profile_id")
        trace_id = data.get("trace_id")
        if not profile_id_str:
            logger.error(
                f"Missing profile_id in rubric_tool_standard_group_descriptions for {sid}"
            )
            await standard_group_descriptions_tool_error(
                StandardGroupDescriptionsToolErrorPayload(
                    success=False,
                    message="Missing profile_id in payload",
                    trace_id=trace_id or "unknown",
                ),
                room=sid,
            )
            return
        
        profile_id = uuid.UUID(profile_id_str)
        payload_dict = {k: v for k, v in data.items() if k not in ("profile_id", "trace_id")}
        validated = UpdateStandardDescriptionsApiRequest(**payload_dict)
        await _rubric_tool_standard_group_descriptions_impl(sid, validated, profile_id, trace_id)
    except ValidationError as e:
        logger.error(
            f"Validation error in rubric_tool_standard_group_descriptions for {sid}: {e}"
        )
        await standard_group_descriptions_tool_error(
            StandardGroupDescriptionsToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )


@internal_sio.on("rubric_tool_standard_group_descriptions")
async def rubric_tool_standard_group_descriptions_internal(
    data: dict[str, Any],
) -> None:
    """Handle standard group descriptions update event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error(
            "[rubric_tool_standard_group_descriptions_internal] Missing 'sid' in payload"
        )
        return
    
    # Extract sid, profile_id, and trace_id before validation (not in ApiRequest)
    profile_id_str = data.get("profile_id")
    trace_id = data.get("trace_id")
    if not profile_id_str:
        logger.error(
            "[rubric_tool_standard_group_descriptions_internal] Missing 'profile_id' in payload"
        )
        await standard_group_descriptions_tool_error(
            StandardGroupDescriptionsToolErrorPayload(
                success=False,
                message="Missing profile_id in payload",
                trace_id=trace_id or "unknown",
            ),
            room=sid,
        )
        return
    
    profile_id = uuid.UUID(profile_id_str)
    payload_dict = {k: v for k, v in data.items() if k not in ("sid", "profile_id", "trace_id")}
    
    try:
        # Validate with same ApiRequest type used by emitter
        validated = UpdateStandardDescriptionsApiRequest(**payload_dict)
        await _rubric_tool_standard_group_descriptions_impl(sid, validated, profile_id, trace_id)
    except ValidationError as e:
        logger.error(
            f"Validation error in rubric_tool_standard_group_descriptions_internal: {e}"
        )
        await standard_group_descriptions_tool_error(
            StandardGroupDescriptionsToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=trace_id or "unknown",
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/standard_group_descriptions", response_model=dict[str, bool])
async def rubric_tool_standard_group_descriptions_api(
    request: UpdateStandardDescriptionsApiRequest,
) -> dict[str, bool]:
    """Client-to-server event: Update standard group descriptions from rubric generation tool."""
    return {"success": True}


@server_router.post(
    "/standard_group_descriptions_complete", response_model=dict[str, bool]
)
async def standard_group_descriptions_tool_complete_api(
    request: StandardGroupDescriptionsToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Standard group descriptions tool completed successfully."""
    return {"success": True}


@server_router.post(
    "/standard_group_descriptions_error", response_model=dict[str, bool]
)
async def standard_group_descriptions_tool_error_api(
    request: StandardGroupDescriptionsToolErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in standard group descriptions tool."""
    return {"success": True}

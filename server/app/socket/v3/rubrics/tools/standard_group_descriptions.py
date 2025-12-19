"""Handler for rubric_tool_standard_group_descriptions WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class StandardGroupDescriptionsToolPayload(BaseModel):
    """Request to update standard group descriptions from rubric generation tool."""

    trace_id: str
    rubric_id: str
    descriptions: list[
        dict[str, Any]
    ]  # Array of {standard_group_id, standard_id, description}


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
    sid: str, data: dict[str, Any]
) -> None:
    """Internal implementation for standard group descriptions update."""
    logger.info(
        f"[rubric_tool_standard_group_descriptions] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = StandardGroupDescriptionsToolPayload(**data)
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
        return

    trace_id = validated.trace_id
    rubric_id_uuid = uuid.UUID(validated.rubric_id)
    pool = get_pool()

    if not pool:
        await standard_group_descriptions_tool_error(
            StandardGroupDescriptionsToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            # Convert descriptions list to JSONB array
            import json

            descriptions_json = json.dumps(validated.descriptions)

            # Update standard descriptions using SQL file
            sql = load_sql("sql/v3/rubrics/update_standard_descriptions.sql")
            result = await conn.fetchrow(sql, str(rubric_id_uuid), descriptions_json)

            if not result:
                await standard_group_descriptions_tool_error(
                    StandardGroupDescriptionsToolErrorPayload(
                        success=False,
                        message="Failed to update standard descriptions",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            updated_count = result["updated_count"]

            logger.info(
                f"✓ Updated {updated_count} standard descriptions "
                f"(rubric_id={rubric_id_uuid}, trace_id={trace_id})"
            )

            # Invalidate rubrics cache
            await invalidate_tags(["rubrics", f"rubric:{validated.rubric_id}"])

            await standard_group_descriptions_tool_complete(
                StandardGroupDescriptionsToolCompletePayload(
                    success=True,
                    rubric_id=validated.rubric_id,
                    updated_count=updated_count,
                    trace_id=trace_id,
                    message=f"Updated {updated_count} standard descriptions successfully",
                    descriptions=validated.descriptions,
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
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def rubric_tool_standard_group_descriptions(
    sid: str, data: dict[str, Any]
) -> None:
    """Handle standard group descriptions update event from rubric generation tool (client-to-server)."""
    await _rubric_tool_standard_group_descriptions_impl(sid, data)


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
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _rubric_tool_standard_group_descriptions_impl(sid, payload)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/standard_group_descriptions", response_model=dict[str, bool])
async def rubric_tool_standard_group_descriptions_api(
    request: StandardGroupDescriptionsToolPayload,
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

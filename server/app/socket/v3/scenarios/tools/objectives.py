"""Handler for scenario_tool_objectives WebSocket event."""

import uuid
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ObjectivesToolPayload(BaseModel):
    trace_id: str
    objectives: list[str]
    scenario_id: str | None = None


class ObjectivesToolCompletePayload(BaseModel):
    success: bool
    objective_ids: list[str]
    trace_id: str
    message: str | None = None


class ObjectivesToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def objectives_tool_complete(
    payload: ObjectivesToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[scenario_tool_objectives_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"objective_ids={payload.objective_ids}"
    )
    await sio.emit("scenario_tool_objectives_complete", payload.model_dump(), room=room)
    logger.info(f"[scenario_tool_objectives_complete] Emitted to room={room}")


async def objectives_tool_error(payload: ObjectivesToolErrorPayload, room: str) -> None:
    await sio.emit("scenario_tool_objectives_error", payload.model_dump(), room=room)


async def _scenario_tool_objectives_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for objectives creation."""
    logger.info(
        f"[scenario_tool_objectives] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = ObjectivesToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_objectives for {sid}: {e}")
        await objectives_tool_error(
            ObjectivesToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await objectives_tool_error(
            ObjectivesToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            # Limit to maximum 3 objectives
            objectives = validated.objectives[:3]
            scenario_id_uuid = (
                uuid.UUID(validated.scenario_id) if validated.scenario_id else None
            )

            sql = load_sql("sql/v3/objectives/insert_objective_complete.sql")
            objective_ids = []

            for idx, objective in enumerate(objectives):
                result = await conn.fetchrow(
                    sql,
                    objective,  # objective text
                    idx,  # idx
                    str(scenario_id_uuid)
                    if scenario_id_uuid
                    else None,  # scenario_id (nullable)
                )

                if not result:
                    logger.warning(
                        f"Failed to create objective {idx} '{objective}' (trace_id={trace_id})"
                    )
                    continue

                objective_ids.append(result["objective_id"])

            if not objective_ids:
                await objectives_tool_error(
                    ObjectivesToolErrorPayload(
                        success=False,
                        message="Failed to create any objectives",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            logger.info(
                f"✓ Created {len(objective_ids)} objectives "
                f"(scenario_id={scenario_id_uuid}, trace_id={trace_id})"
            )

            await objectives_tool_complete(
                ObjectivesToolCompletePayload(
                    success=True,
                    objective_ids=objective_ids,
                    trace_id=trace_id,
                    message=f"Created {len(objective_ids)} objectives successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in scenario_tool_objectives for {sid}: {str(e)}", exc_info=True
        )
        await objectives_tool_error(
            ObjectivesToolErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_tool_objectives(sid: str, data: dict[str, Any]) -> None:
    """Handle objectives creation event from scenario generation tool (client-to-server)."""
    await _scenario_tool_objectives_impl(sid, data)


@internal_sio.on("scenario_tool_objectives")
async def scenario_tool_objectives_internal(data: dict[str, Any]) -> None:
    """Handle objectives creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[scenario_tool_objectives_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _scenario_tool_objectives_impl(sid, payload)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/objectives", response_model=dict[str, bool])
async def scenario_tool_objectives_api(request: ObjectivesToolPayload) -> dict[str, bool]:
    """Client-to-server event: Create objectives from scenario generation tool."""
    return {"success": True}


@server_router.post("/objectives_complete", response_model=dict[str, bool])
async def objectives_tool_complete_api(request: ObjectivesToolCompletePayload) -> dict[str, bool]:
    """Server-to-client event: Objectives tool completed successfully."""
    return {"success": True}

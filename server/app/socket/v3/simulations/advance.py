"""Handler for simulation_advance WebSocket event - attaches scenario to simulation and notifies client."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class SimulationAdvancedPayload(BaseModel):
    """Response indicating simulation advanced successfully."""

    success: bool
    message: str
    chat_id: str
    scenario_id: str
    attempt_id: str


class SimulationAdvanceErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation advance."""

    success: bool
    message: str


# Pydantic model for internal event
class SimulationAdvancePayload(BaseModel):
    """Request to attach scenario to simulation."""

    scenario_id: str
    attempt_id: str
    profile_id: str | None = None
    simulation_id: str | None = None


# Emit helper functions
async def simulation_advanced(
    payload: SimulationAdvancedPayload, room: str
) -> None:
    await sio.emit("simulations_advanced", payload.model_dump(), room=room)


async def simulation_advance_error(
    payload: SimulationAdvanceErrorPayload, room: str
) -> None:
    await sio.emit("simulations_advance_error", payload.model_dump(), room=room)


async def _simulation_advance_impl(sid: str, data: SimulationAdvancePayload) -> None:
    """
    Handle simulation_advance requests via WebSocket.
    Attaches scenario to simulation by creating chat and linking to attempt.
    """
    try:
        logger.info(
            f"Received simulation_advance request from {sid} with data: {data}"
        )

        scenario_id = data.scenario_id
        attempt_id = data.attempt_id
        profile_id = data.profile_id
        simulation_id = data.simulation_id

        if not scenario_id or not attempt_id:
            await simulation_advance_error(
                SimulationAdvanceErrorPayload(
                    success=False, message="Missing scenario_id or attempt_id"
                ),
                room=sid,
            )
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await simulation_advance_error(
                SimulationAdvanceErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            scenario_id_uuid = uuid.UUID(scenario_id)
            attempt_id_uuid = uuid.UUID(attempt_id)

            # Get scenario name for chat title
            sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
            scenario = await conn.fetchrow(sql, scenario_id_uuid)
            if not scenario:
                await simulation_advance_error(
                    SimulationAdvanceErrorPayload(
                        success=False, message="Scenario not found"
                    ),
                    room=sid,
                )
                return

            scenario_name = scenario.get("name", "New Simulation")

            # Generate trace_id
            from agents import gen_trace_id

            trace_id = gen_trace_id()

            # Create chat
            from datetime import datetime, UTC
            created_at = datetime.now(UTC)
            sql = load_sql("app/sql/v3/simulations/create_simulation_chat.sql")
            chat_row = await conn.fetchrow(
                sql,
                created_at,
                scenario_name,
                scenario_id_uuid,
                attempt_id_uuid,
                False,  # completed
                trace_id,
            )

            if not chat_row or not chat_row.get("chat_id"):
                await simulation_advance_error(
                    SimulationAdvanceErrorPayload(
                        success=False, message="Failed to create chat"
                    ),
                    room=sid,
                )
                return

            chat_id = str(chat_row["id"])

            logger.info(
                f"Attached scenario {scenario_id} to attempt {attempt_id}, created chat {chat_id}"
            )

            # Emit success event to client
            await simulation_advanced(
                SimulationAdvancedPayload(
                    success=True,
                    message="Simulation advanced successfully",
                    chat_id=chat_id,
                    scenario_id=scenario_id,
                    attempt_id=attempt_id,
                ),
                room=sid,
            )

            # Also emit to simulation room if simulation_id provided
            if simulation_id:
                await simulation_advanced(
                    SimulationAdvancedPayload(
                        success=True,
                        message="Simulation advanced successfully",
                        chat_id=chat_id,
                        scenario_id=scenario_id,
                        attempt_id=attempt_id,
                    ),
                    room=f"simulation_{simulation_id}",
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.advanced",
                    template="{{ actor.name }} advanced simulation",
                    context={"chat_id": chat_id, "scenario_id": scenario_id},
                    endpoint="/socket/v3/simulations/advance",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging simulation advance activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error in simulation_advance for {sid}: {str(e)}", exc_info=True)
        await simulation_advance_error(
            SimulationAdvanceErrorPayload(success=False, message=str(e)),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.advanced",
                template="{{ actor.name }} failed to advance simulation",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/advance",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation advance error activity: {log_error}"
            )


@internal_sio.on("simulation_advance")  # type: ignore
async def simulation_advance_internal(data: dict[str, Any]) -> None:
    """Handle simulation_advance event from internal bus (server-to-server)."""
    try:
        validated = SimulationAdvancePayload(**data)
        # Get sid from data if present, otherwise use a default
        sid = data.get("sid", "internal")
        await _simulation_advance_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_advance_internal: {e}")
        await simulation_advance_error(
            SimulationAdvanceErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=data.get("sid", "internal"),
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/advance", response_model=dict[str, bool])
async def simulation_advance_api(request: SimulationAdvancePayload) -> dict[str, bool]:
    """Internal event: Attach scenario to simulation."""
    return {"success": True}


@server_router.post("/advance_error", response_model=dict[str, bool])
async def simulation_advance_error_api(
    request: SimulationAdvanceErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in simulation advance."""
    return {"success": True}


@server_router.post("/advanced", response_model=dict[str, bool])
async def simulation_advanced_api(
    request: SimulationAdvancedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation advanced successfully."""
    return {"success": True}


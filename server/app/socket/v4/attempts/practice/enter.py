"""Handler for simulation_enter WebSocket event."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.utils.sql_helper import load_sql

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class SimulationEnterResponsePayload(BaseModel):
    """Response indicating successfully updated chat created_at timestamp."""

    success: bool
    message: str
    chat_id: str


class SimulationEnterErrorPayload(BaseModel):
    """Response indicating an error occurred while updating chat created_at timestamp."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class SimulationEnterPayload(BaseModel):
    """Request to update chat created_at timestamp when entering a chat."""

    chat_id: str
    created_at: str  # ISO format datetime string


# Emit helper functions
async def simulation_enter_response(
    payload: SimulationEnterResponsePayload, room: str
) -> None:
    await sio.emit("simulation_enter_response", payload.model_dump(), room=room)


async def simulation_enter_error(
    payload: SimulationEnterErrorPayload, room: str
) -> None:
    await sio.emit("simulation_enter_error", payload.model_dump(), room=room)


async def _simulation_enter_impl(sid: str, data: SimulationEnterPayload) -> None:
    """Update chat created_at timestamp when entering a chat."""
    try:
        chat_id = data.chat_id
        created_at_str = data.created_at

        if not chat_id:
            await simulation_enter_error(
                SimulationEnterErrorPayload(
                    success=False, message="Missing chat_id in request"
                ),
                room=sid,
            )
            return

        # Parse ISO datetime string
        try:
            created_at_dt = datetime.fromisoformat(
                created_at_str.replace("Z", "+00:00")
            )
            if created_at_dt.tzinfo is None:
                created_at_dt = created_at_dt.replace(tzinfo=UTC)
        except (ValueError, AttributeError) as e:
            await simulation_enter_error(
                SimulationEnterErrorPayload(
                    success=False, message=f"Invalid created_at format: {str(e)}"
                ),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Load and execute SQL query
            sql_query = load_sql(
                "app/sql/v4/queries/attempts/update_chat_created_at_complete.sql"
            )
            result = await conn.fetchrow(sql_query, created_at_dt, chat_id)

            if result and result.get("chat_id"):
                await simulation_enter_response(
                    SimulationEnterResponsePayload(
                        success=True,
                        message="Chat created_at timestamp updated successfully",
                        chat_id=chat_id,
                    ),
                    room=sid,
                )
                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="simulations.entered",
                        template="{{ actor.name }} entered simulation chat",
                        context={"chat_id": chat_id},
                        endpoint="/socket/v4/simulations/enter",
                        error=False,
                    )
                except Exception:
                    pass
            else:
                await simulation_enter_error(
                    SimulationEnterErrorPayload(
                        success=False, message=f"Chat {chat_id} not found"
                    ),
                    room=sid,
                )

    except Exception as e:
        await simulation_enter_error(
            SimulationEnterErrorPayload(
                success=False, message=f"Failed to update chat timestamp: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.entered",
                template="{{ actor.name }} failed to enter simulation chat",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/enter",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def simulation_enter(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = SimulationEnterPayload(**data)
        await _simulation_enter_impl(sid, validated)
    except ValidationError as e:
        await simulation_enter_error(
            SimulationEnterErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.entered",
                template="{{ actor.name }} failed to enter simulation chat (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/enter",
                error=True,
            )
        except Exception:
            pass


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/enter", response_model=dict[str, bool])
async def simulation_enter_api(request: SimulationEnterPayload) -> dict[str, bool]:
    """Client-to-server event: Update chat created_at timestamp when entering a chat."""
    return {"success": True}


@server_router.post("/enter_response", response_model=dict[str, bool])
async def simulation_enter_response_api(
    request: SimulationEnterResponsePayload,
) -> dict[str, bool]:
    """Server-to-client event: Successfully updated chat created_at timestamp."""
    return {"success": True}


@server_router.post("/enter_error", response_model=dict[str, bool])
async def simulation_enter_error_api(
    request: SimulationEnterErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while updating chat created_at timestamp."""
    return {"success": True}

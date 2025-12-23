"""Handler for simulation_message_create internal event - creates user messages."""

import uuid
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.socket.v3.simulations.streaming.message import (
    SimulationNewMessagePayload, simulation_new_message)
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class CreateSimulationMessagePayload(BaseModel):
    """Request to create a user message."""

    chat_id: str
    message_content: str
    run_id: str
    sid: str | None = None  # WebSocket session ID for error handling


async def _simulation_message_create_impl(
    chat_id: uuid.UUID,
    message_content: str,
    run_id: uuid.UUID,
    sid: str | None = None,
) -> dict[str, Any] | None:
    """Internal implementation for creating a user message."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for message creation")
        return None

    async with pool.acquire() as conn:
        try:
            # Create user message with linking and branching in single transaction
            sql = load_sql("app/sql/v3/simulations/create_user_message_complete.sql")
            result_row = await conn.fetchrow(
                sql, str(chat_id), message_content, str(run_id)
            )

            if not result_row:
                logger.error(f"Failed to create user message for chat {chat_id}")
                return None

            message_id = result_row["message_id"]
            created_at = result_row["created_at"]

            # Emit client event
            await simulation_new_message(
                SimulationNewMessagePayload(
                    message_id=str(message_id),
                    chat_id=str(chat_id),
                    role="user",
                    content=message_content,
                    completed=True,
                    created_at=created_at.isoformat(),
                ),
                room=f"simulation_{chat_id}",
            )

            logger.info(
                f"Created user message {message_id} for chat {chat_id}, run {run_id}"
            )

            return {
                "message_id": str(message_id),
                "created_at": created_at.isoformat(),
                "parent_message_id": (
                    str(result_row["parent_message_id"])
                    if result_row.get("parent_message_id")
                    else None
                ),
            }

        except Exception as e:
            logger.error(
                f"Error creating user message for chat {chat_id}: {e}",
                exc_info=True,
            )
            return None


@internal_sio.on("simulation_message_create")
async def simulation_message_create_internal(data: dict[str, Any]) -> None:
    """Handle simulation_message_create event from internal bus."""
    try:
        validated = CreateSimulationMessagePayload(**data)
        await _simulation_message_create_impl(
            uuid.UUID(validated.chat_id),
            validated.message_content,
            uuid.UUID(validated.run_id),
            validated.sid,
        )
    except ValidationError as e:
        logger.error(f"Validation error in simulation_message_create: {e}")
    except Exception as e:
        logger.error(
            f"Error in simulation_message_create_internal: {e}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/create", response_model=dict[str, bool])
async def simulation_message_create_api(
    request: CreateSimulationMessagePayload,
) -> dict[str, bool]:
    """Internal event: Create a user message for a simulation."""
    return {"success": True}


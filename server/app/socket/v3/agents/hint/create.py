"""Handler for simulation_hints_create internal event - creates hint records."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from app.socket.v3.agents.hint.generate import (
    HintGenerationProgressPayload, hint_generation_progress)
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class CreateSimulationHintsPayload(BaseModel):
    """Request to create simulation hints."""

    chat_id: str
    message_id: str
    hints: list[str]  # List of hint texts
    sid: str | None = None  # WebSocket session ID for error handling


async def _simulation_hints_create_impl(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    hints: list[str],
    sid: str | None = None,
) -> list[dict[str, Any]]:
    """Internal implementation for creating simulation hints."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for hint creation")
        return []

    async with pool.acquire() as conn:
        try:
            # Filter out empty hints
            non_empty_hints = [h for h in hints if h and h.strip()]

            if not non_empty_hints:
                logger.warning(
                    f"No non-empty hints provided for message {message_id}"
                )
                return []

            # Create hints in single transaction
            sql = load_sql("app/sql/v3/simulations/create_hints_complete.sql")
            result_row = await conn.fetchrow(
                sql, str(message_id), non_empty_hints
            )

            if not result_row or not result_row.get("hint_ids"):
                logger.error(f"Failed to create hints for message {message_id}")
                return []

            hint_ids = result_row["hint_ids"]
            if isinstance(hint_ids, str):
                import json

                hint_ids = json.loads(hint_ids)
            elif hint_ids is None:
                hint_ids = []

            logger.info(
                f"Created {len(hint_ids)} hints for message {message_id} in chat {chat_id}"
            )

            return hint_ids

        except Exception as e:
            logger.error(
                f"Error creating hints for message {message_id}: {e}",
                exc_info=True,
            )
            return []


@internal_sio.on("simulation_hints_create")
async def simulation_hints_create_internal(data: dict[str, Any]) -> None:
    """Handle simulation_hints_create event from internal bus."""
    try:
        validated = CreateSimulationHintsPayload(**data)
        hint_ids = await _simulation_hints_create_impl(
            uuid.UUID(validated.chat_id),
            uuid.UUID(validated.message_id),
            validated.hints,
            validated.sid,
        )

        # Emit completion event if hints were created
        if hint_ids:
            from app.socket.v3.agents.hint.generate import HintItem

            hints_for_event = [
                HintItem(idx=h["idx"], hint=h.get("hint", "")) for h in hint_ids
            ]

            await hint_generation_progress(
                HintGenerationProgressPayload(
                    type="complete",
                    message="Hints created successfully",
                    chat_id=validated.chat_id,
                    message_id=validated.message_id,
                    hint_ids=[
                        f"{h['simulation_message_id']}_{h['idx']}"
                        for h in hint_ids
                    ],
                    hints_count=len(hint_ids),
                    hints=hints_for_event,
                ),
                room=f"simulation_{validated.chat_id}",
            )

    except ValidationError as e:
        logger.error(f"Validation error in simulation_hints_create: {e}")
    except Exception as e:
        logger.error(
            f"Error in simulation_hints_create_internal: {e}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/create", response_model=dict[str, bool])
async def simulation_hints_create_api(
    request: CreateSimulationHintsPayload,
) -> dict[str, bool]:
    """Internal event: Create simulation hints for a message."""
    return {"success": True}


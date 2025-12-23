"""Handler for simulation_run_create internal event - creates runs for simulation chats."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class CreateSimulationRunPayload(BaseModel):
    """Request to create a run for a simulation chat."""

    department_id: str
    model_id: str
    persona_id: str
    profile_id: str
    agent_id: str
    sid: str | None = None  # WebSocket session ID for error handling


async def _simulation_run_create_impl(
    department_id: uuid.UUID,
    model_id: uuid.UUID,
    persona_id: uuid.UUID,
    profile_id: uuid.UUID,
    agent_id: uuid.UUID,
    sid: str | None = None,
) -> str | None:
    """Internal implementation for creating a simulation run."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for run creation")
        return None

    async with pool.acquire() as conn:
        try:
            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id),
                str(model_id),
                str(persona_id),
                "persona",
                str(profile_id),
                None,  # key_id
                str(agent_id),  # agent_id
            )

            if not model_run_row or not model_run_row.get("run_id"):
                logger.error("Failed to create run")
                return None

            run_id = model_run_row["run_id"]
            logger.info(f"Created run {run_id} for simulation")
            return run_id

        except Exception as e:
            logger.error(f"Error creating run: {e}", exc_info=True)
            return None


@internal_sio.on("simulation_run_create")
async def simulation_run_create_internal(data: dict[str, Any]) -> None:
    """Handle simulation_run_create event from internal bus."""
    try:
        validated = CreateSimulationRunPayload(**data)
        run_id = await _simulation_run_create_impl(
            uuid.UUID(validated.department_id),
            uuid.UUID(validated.model_id),
            uuid.UUID(validated.persona_id),
            uuid.UUID(validated.profile_id),
            uuid.UUID(validated.agent_id),
            validated.sid,
        )
        # Note: Caller should handle the run_id return value
        # For async events, we don't return values, so the caller must await the event
        # or use a callback pattern. For now, we'll log success.
        if run_id:
            logger.info(f"Simulation run created successfully: {run_id}")
    except ValidationError as e:
        logger.error(f"Validation error in simulation_run_create: {e}")
    except Exception as e:
        logger.error(
            f"Error in simulation_run_create_internal: {e}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/create", response_model=dict[str, bool])
async def simulation_run_create_api(
    request: CreateSimulationRunPayload,
) -> dict[str, bool]:
    """Internal event: Create a run for a simulation chat."""
    return {"success": True}


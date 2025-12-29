"""Handler for simulation_messages_link internal event - links system/developer messages to runs."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import get_internal_sio, get_pool

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class LinkMessagesToRunPayload(BaseModel):
    """Request to link system/developer messages to a run."""

    run_id: str
    department_id: str | None = None
    chat_id: str | None = None
    sid: str | None = None  # WebSocket session ID for error handling


async def _simulation_messages_link_impl(
    run_id: uuid.UUID,
    department_id: uuid.UUID | None = None,
    chat_id: uuid.UUID | None = None,
    sid: str | None = None,
) -> bool:
    """Internal implementation for linking system/developer messages to a run."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for message linking")
        return False

    async with pool.acquire() as conn:
        try:
            # Link system/developer messages to run
            sql_link_sys_dev = load_sql(
                "app/sql/v3/model_runs/link_system_developer_messages_to_run.sql"
            )
            result = await conn.fetchrow(
                sql_link_sys_dev,
                str(run_id),
                str(department_id) if department_id else None,
                str(chat_id) if chat_id else None,
            )

            if result:
                logger.info(
                    f"Linked system/developer messages to run {run_id} "
                    f"(department_id={department_id}, chat_id={chat_id})"
                )
                return True
            else:
                logger.warning(f"No messages linked for run {run_id}")
                return False

        except Exception as e:
            logger.error(
                f"Error linking messages to run {run_id}: {e}",
                exc_info=True,
            )
            return False


@internal_sio.on("simulation_messages_link")
async def simulation_messages_link_internal(data: dict[str, Any]) -> None:
    """Handle simulation_messages_link event from internal bus."""
    try:
        validated = LinkMessagesToRunPayload(**data)
        await _simulation_messages_link_impl(
            uuid.UUID(validated.run_id),
            uuid.UUID(validated.department_id) if validated.department_id else None,
            uuid.UUID(validated.chat_id) if validated.chat_id else None,
            validated.sid,
        )
    except ValidationError as e:
        logger.error(f"Validation error in simulation_messages_link: {e}")
    except Exception as e:
        logger.error(f"Error in simulation_messages_link_internal: {e}", exc_info=True)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/link", response_model=dict[str, bool])
async def simulation_messages_link_api(
    request: LinkMessagesToRunPayload,
) -> dict[str, bool]:
    """Internal event: Link system/developer messages to a run."""
    return {"success": True}
